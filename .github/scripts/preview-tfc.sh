#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# aws-preview ワークスペースの preview_pull_requests を書き換えて run を起こす。
#
#   preview-tfc.sh upsert <PR番号> <イメージタグ>
#   preview-tfc.sh remove <PR番号>
#   preview-tfc.sh reconcile '<open な PR 番号の JSON 配列>'
#
# 変数は HCL 型で登録しておくが、書き込む値は JSON にする。HCL のオブジェクト
# 構文は {"key": value} 表記も受け付けるので、JSON はそのまま有効な HCL 式と
# して解釈され、こちら側は jq だけで読み書きできる。
#
# 読んで書く操作なので、複数の PR が同時に走ると片方の更新が消える。呼び出し側の
# ワークフローで PR 番号を含めない concurrency グループに入れて直列化すること
# (それでも取りこぼしうるので、夜間の再収束ジョブが最後の砦になる)。
#
# 環境変数:
#   TFC_TOKEN         aws-preview ワークスペースにスコープしたチームトークン (必須)
#   TFC_ORGANIZATION  組織名
#   TFC_WORKSPACE     ワークスペース名
#   TFC_VAR_NAME      書き換える変数名
#   TFC_RUN_TIMEOUT   run の完了を待つ秒数
#
# 標準出力には何も垂れ流さない。結果は $GITHUB_OUTPUT に書く。
# ---------------------------------------------------------------------------
set -euo pipefail

# TFC_API_BASE は Terraform Enterprise (自ホスト) 用の逃げ道。
readonly BASE_URL="${TFC_API_BASE:-https://app.terraform.io}"
readonly API="${BASE_URL}/api/v2"
readonly ORG="${TFC_ORGANIZATION:?TFC_ORGANIZATION が未設定です}"
readonly WORKSPACE="${TFC_WORKSPACE:?TFC_WORKSPACE が未設定です}"
readonly VAR_NAME="${TFC_VAR_NAME:-preview_pull_requests}"
readonly RUN_TIMEOUT="${TFC_RUN_TIMEOUT:-1800}"
: "${TFC_TOKEN:?TFC_TOKEN が未設定です}"

log() { echo "$*" >&2; }

emit() {
  [ -n "${GITHUB_OUTPUT:-}" ] || return 0
  echo "$1=$2" >>"$GITHUB_OUTPUT"
}

# curl のラッパー。HTTP ステータスを見て、失敗したら本文ごと落とす。
api() {
  local method=$1 path=$2 body=${3:-}
  local response status

  if [ -n "$body" ]; then
    response=$(curl -sS -w $'\n%{http_code}' -X "$method" "${API}${path}" \
      -H "Authorization: Bearer ${TFC_TOKEN}" \
      -H "Content-Type: application/vnd.api+json" \
      -d "$body")
  else
    response=$(curl -sS -w $'\n%{http_code}' -X "$method" "${API}${path}" \
      -H "Authorization: Bearer ${TFC_TOKEN}")
  fi

  status=${response##*$'\n'}
  body=${response%$'\n'*}

  if [ "$status" -lt 200 ] || [ "$status" -ge 300 ]; then
    log "::error::TFC API ${method} ${path} が ${status} を返しました"
    log "$body"
    return 1
  fi

  printf '%s' "$body"
}

# ---------------------------------------------------------------------------
# 変数の読み書き
# ---------------------------------------------------------------------------

workspace_id() {
  api GET "/organizations/${ORG}/workspaces/${WORKSPACE}" | jq -r '.data.id'
}

# 変数が無ければ空リストで作る。戻り値は "<変数ID> <現在値の JSON>"。
read_variable() {
  local ws_id=$1 vars var_id raw sensitive

  vars=$(api GET "/workspaces/${ws_id}/vars")
  var_id=$(jq -r --arg key "$VAR_NAME" \
    '.data[] | select(.attributes.key == $key and .attributes.category == "terraform") | .id' <<<"$vars")

  if [ -z "$var_id" ]; then
    log "変数 ${VAR_NAME} が無いので空リストで作ります"
    var_id=$(api POST "/workspaces/${ws_id}/vars" "$(
      jq -nc --arg key "$VAR_NAME" '{
        data: {
          type: "vars",
          attributes: {
            key: $key,
            value: "[]",
            category: "terraform",
            hcl: true,
            sensitive: false,
            description: "app リポジトリの GitHub Actions が書き換えます"
          }
        }
      }'
    )" | jq -r '.data.id')
    echo "$var_id []"
    return
  fi

  sensitive=$(jq -r --arg key "$VAR_NAME" \
    '.data[] | select(.attributes.key == $key and .attributes.category == "terraform") | .attributes.sensitive' <<<"$vars")

  if [ "$sensitive" = "true" ]; then
    log "::error::変数 ${VAR_NAME} が sensitive になっています。値を読めないので sensitive を外してください。"
    return 1
  fi

  raw=$(jq -r --arg key "$VAR_NAME" \
    '.data[] | select(.attributes.key == $key and .attributes.category == "terraform") | .attributes.value' <<<"$vars")
  [ -n "$raw" ] || raw="[]"

  if ! jq -e 'type == "array"' >/dev/null 2>&1 <<<"$raw"; then
    log "::error::変数 ${VAR_NAME} の現在値が JSON 配列として読めません。手で書き換えた場合は JSON 形式に戻してください。"
    log "現在値: ${raw}"
    return 1
  fi

  echo "$var_id $(jq -c . <<<"$raw")"
}

write_variable() {
  local ws_id=$1 var_id=$2 value=$3

  api PATCH "/workspaces/${ws_id}/vars/${var_id}" "$(
    jq -nc --arg id "$var_id" --arg value "$value" '{
      data: { id: $id, type: "vars", attributes: { value: $value } }
    }'
  )" >/dev/null
}

# ---------------------------------------------------------------------------
# run
# ---------------------------------------------------------------------------

start_run() {
  local ws_id=$1 message=$2

  api POST "/runs" "$(
    jq -nc --arg id "$ws_id" --arg message "$message" '{
      data: {
        type: "runs",
        attributes: { message: $message },
        relationships: { workspace: { data: { type: "workspaces", id: $id } } }
      }
    }'
  )" | jq -r '.data.id'
}

# ワークスペースは auto-apply 設定なので、あとは終わるのを待つだけ。
wait_for_run() {
  local run_id=$1 deadline status
  deadline=$(($(date +%s) + RUN_TIMEOUT))

  while :; do
    status=$(api GET "/runs/${run_id}" | jq -r '.data.attributes.status')

    case "$status" in
      applied | planned_and_finished)
        log "run ${run_id}: ${status}"
        return 0
        ;;
      errored | canceled | force_canceled | discarded)
        log "::error::run ${run_id} が ${status} で終わりました: ${RUN_URL}"
        return 1
        ;;
      planned | planned_and_saved | post_plan_awaiting_decision | policy_override)
        # auto-apply が効いていれば planned はすぐ confirmed → applying に進む。
        # ここで止まり続けるならワークスペースの Auto-apply 設定を疑う。
        log "run ${run_id}: ${status} (Auto-apply が無効だと人の確認待ちで止まります)"
        ;;
      *)
        log "run ${run_id}: ${status}"
        ;;
    esac

    if [ "$(date +%s)" -ge "$deadline" ]; then
      log "::error::run ${run_id} が ${RUN_TIMEOUT} 秒以内に終わりませんでした: ${RUN_URL}"
      return 1
    fi

    sleep 10
  done
}

# ---------------------------------------------------------------------------

main() {
  local command=${1:-}
  local ws_id variable var_id current updated message

  # 代入を宣言と分けているのは、失敗を set -e に拾わせるため
  # (local var=$(...) だと local 自身の終了ステータスで覆い隠される)。
  ws_id=$(workspace_id)
  variable=$(read_variable "$ws_id")
  var_id=${variable%% *}
  current=${variable#* }

  case "$command" in
    upsert)
      local number=${2:?PR 番号を指定してください} tag=${3:?イメージタグを指定してください}
      updated=$(jq -c --argjson number "$number" --arg image_tag "$tag" \
        'map(select(.number != $number)) + [{number: $number, image_tag: $image_tag}] | sort_by(.number)' \
        <<<"$current")
      message="PR #${number}: プレビューを ${tag} に更新"
      ;;
    remove)
      local number=${2:?PR 番号を指定してください}
      updated=$(jq -c --argjson number "$number" 'map(select(.number != $number))' <<<"$current")
      message="PR #${number}: プレビューを削除"
      ;;
    reconcile)
      local open=${2:?open な PR 番号の JSON 配列を指定してください}
      updated=$(jq -c --argjson open "$open" 'map(select(.number as $n | $open | index($n)))' <<<"$current")
      message="夜間の再収束: open な PR だけを残す"
      ;;
    *)
      log "使い方: $0 {upsert <PR番号> <タグ>|remove <PR番号>|reconcile <JSON配列>}"
      return 2
      ;;
  esac

  if [ "$updated" = "$current" ]; then
    log "preview_pull_requests に変化がないので run を起こしません"
    emit changed false
    return 0
  fi

  log "変更前: ${current}"
  log "変更後: ${updated}"

  write_variable "$ws_id" "$var_id" "$updated"

  local run_id
  run_id=$(start_run "$ws_id" "$message")
  RUN_URL="${BASE_URL}/app/${ORG}/workspaces/${WORKSPACE}/runs/${run_id}"

  log "run を起こしました: ${RUN_URL}"
  emit changed true
  emit run_url "$RUN_URL"

  wait_for_run "$run_id"
}

main "$@"
