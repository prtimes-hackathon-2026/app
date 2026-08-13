# 広報伴走エージェント — バックエンド設計

PR TIMES を使ったが配信が止まっている中小企業の担当者に対し、
**対話を通じて「次の1本」を確定させる**画面と、その裏側のエージェント基盤の設計。

実装前のレビュー用ドキュメント。決まっていないことは「未決」として明記する。

---

## 1. 何を作るのか

`voice-agent/` のプロトタイプで検証した対話を、本体アプリの機能として作り直す。

- 画面: `/pr-agent`（仮）— 3往復で完結する対話
- バックエンド: 対話を進めるユースケース、事例照合、LLM 呼び出し、会話の永続化

### 対話の構造（固定）

| ターン | 出す事実 | 問い |
| ------ | -------- | ---- |
| 0 | 現在地・似た企業の実績・自社の位置・未使用機能 | なし（提示のみ） |
| 1 | ターン0 の続きとして関心を選ばせる | 4択 + その他 |
| 2 | 目標・見込み度・機能提案 | 確認1つ |
| 3 | 最初の一手を1つ | なし（終端） |

**4往復を超えたら設計として失敗**という制約が仕様に入っている。
したがって会話は可変長ループではなく、**状態が4つしかない有限状態機械**として実装する。

### 設計の核（仕様から導かれる不変条件）

1. **質問だけのターンを作らない** — 毎ターン、相手が知らなかった事実を1つ以上返す
2. **抽象的な目的を聞かない** — ラダリング（「なぜ」「それが実現したら」）は使わない
3. **3層（トップ/ミドル/ボトム）は裏で推定するだけ** — 相手には質問しない
4. **達成できない目標は達成できないと言う** — 事例がなければ「前例がない」と明示する

1 と 2 は、コードで機械的に検証できる形に落とす（§6）。

---

## 2. Notion の「目的の抽出」との矛盾（要確認）

Notion の
[目的の抽出ページ](https://app.notion.com/p/3bb5cf8421b680af81dfedfd8e14dd3a)
には、**これと正反対の対話設計**が書かれている。

| 論点 | Notion「目的の抽出」 | 今回のシステムプロンプト |
| ---- | -------------------- | ------------------------ |
| 質問形式 | 自由回答のオープンクエスチョン | 選択肢を提示して選ばせる |
| ラダリング | 「なぜ、今まで表に出してこなかったのでしょうか？」等を積極的に使う | **使用を明示的に禁止** |
| 目的の階層 | ユーザーと対話して3階層を作る | **裏で推定するだけ。聞かない** |
| ターン数 | 完成サンプルで17問 | **4往復を超えたら失敗** |
| 言い換え確認 | 「〜という理解で合っていますか？」が型 | **情報量ゼロとして禁止** |
| 終了条件 | 各階層が揃い相互接続 + 期間が十分 | ターン3で最初の一手を確定 |

本設計は**システムプロンプト側を正**として書いている。
Notion 側が古い検討過程なのか、別機能として残すのかは未決。
（Notion の2日目振り返りに「抽象的な議論を続けてきたこともあり、具体的に技術的な処理方法を
検討する中で認識の違いに気づくことがありました」という記述があり、
この転換自体は記録されているが、どちらを採るかは書かれていない）

---

## 3. レイヤー構成

`README.md` の依存方向（`app → feature → external`、`shared` は末端）に従う。
この方向は `eslint.config.mjs` の `no-restricted-imports` で機械的に強制されており、
特に **`domain` / `application` は `next` / `react` / `drizzle-orm` / `postgres` を import できない**。

`@openai/agents` も同じ扱いにする。**LLM はポート（interface）として抽象化し、
実装は `infrastructure` に置く**。これがこの設計に整合する唯一の形。

```
src/
├── app/
│   ├── pr-agent/page.tsx                     画面
│   └── api/pr-agent/conversations/route.ts   POST 会話開始
│   └── api/pr-agent/conversations/[id]/answers/route.ts   POST 回答→次のターン
│
├── feature/
│   ├── pr-agent/                             対話の進行
│   │   ├── domain/
│   │   │   ├── conversation.ts               会話・ターン・状態遷移
│   │   │   ├── turn-view.ts                  1ターンの提示物（■見出し + 事実 + 問い）
│   │   │   ├── interest.ts                   4つの関心
│   │   │   ├── outlook.ts                    見込み度の3分類
│   │   │   ├── narrator.ts                   ポート: 下書き→文章
│   │   │   ├── classifier.ts                 ポート: 自由発話→4分類
│   │   │   ├── profiler.ts                   ポート: 3層の推定
│   │   │   ├── company-facts.ts              ポート: 事実の取得
│   │   │   └── conversation-repository.ts    ポート: 永続化
│   │   ├── application/
│   │   │   ├── start-conversation.ts         ターン0を組む
│   │   │   ├── advance-conversation.ts       ターン1〜3を進める
│   │   │   └── validate-turn.ts              不変条件の検証（§6）
│   │   ├── infrastructure/
│   │   │   ├── narrator.openai.ts            Agents SDK 実装
│   │   │   ├── classifier.openai.ts          Agents SDK 実装
│   │   │   ├── profiler.openai.ts            Agents SDK 実装
│   │   │   ├── company-facts.feature.ts      pr-metrics の公開 API を呼ぶ
│   │   │   └── conversation-repository.drizzle.ts
│   │   └── index.ts
│   │
│   └── pr-metrics/                           事例照合と指標
│       ├── domain/
│       │   ├── match-key.ts                  業種 × 規模 × PR内容
│       │   ├── match-ladder.ts               フォールバック階段の規則（§5）
│       │   ├── feature-catalog.ts            機能カタログと未使用検出ルール
│       │   └── metrics-repository.ts         ポート
│       ├── application/
│       │   ├── get-company-position.ts       現在地（配信本数・停止月数・直近リリース）
│       │   ├── find-peer-evidence.ts         事例照合（階段を降りる）
│       │   └── detect-unused-features.ts     未使用機能の検出
│       ├── infrastructure/
│       │   └── metrics-repository.drizzle.ts
│       └── index.ts
│
├── external/
│   ├── db/
│   │   ├── app/schema/pr-conversations.ts    会話の永続化
│   │   ├── app/schema/peer-evidence.ts       事前集計の置き場（§5）
│   │   └── prtimes/                          PR TIMES データ（参照専用・未決 §9）
│   └── openai/
│       ├── client.ts                         Runner の生成（プロセスで1つ）
│       └── models.ts                         モデル設定
│
└── shared/env.ts                             OPENAI_API_KEY を追加
```

`pr-agent` から `pr-metrics` は**公開 API 経由でのみ**呼ぶ。
ESLint は `@/feature/*/*`（内部）を禁じるが `@/feature/pr-metrics`（index）は許可しており、
`eslint.config.mjs` のメッセージも「必要なら `@/feature/<domain>` の公開 API を使うこと」と明示している。
ただし `domain` / `application` は他 feature も直接呼ばず、
`CompanyFacts` ポート越しにする（`infrastructure/company-facts.feature.ts` が実装）。

---

## 4. LLM の役割を限定する

プロトタイプで最も効いていた設計判断を継承する。

```
数値・判定・機能選定 … 決定的なコード（SQL とドメインルール）
文章                 … LLM（下書きを言い換えるだけ）
```

LLM に渡すのは **日本語ラベルの辞書**と**テンプレの下書き**だけ。
生の指標名（`eval_point` 等）を渡すと意味を誤読するため、
**指標の定義そのものをキーにする**。

```jsonc
{
  "facts": {
    "御社の配信本数": "1本",
    "停止期間": "12か月",
    "照合した企業群": "SaaS・資本金5,000万円前後・38社／214本",
    "1本目のPV中央値": "820",
    "6本目のPV中央値": "1,340（1本目の1.6倍）",
    "メディア転載が起きる割合": "1本目5% → 6本目28%",
    "データ種別": "模擬データ"
  },
  "draft": {
    "position": "配信は1年前の1本のみ。以降12か月停止しています。",
    "peers": "同業・同規模の38社では、変化が出るのは6本目・約200日後です。",
    "unused": "キーワード設定が0件、メイン画像が未設定です。"
  }
}
```

LLM の仕事は 3つだけ。

| ポート | 役割 | 出力 |
| ------ | ---- | ---- |
| `Narrator` | `draft` を、その会社の商品に即した言葉に書き直す | `draft` と同じキーの JSON |
| `Classifier` | 自由発話を4つの関心のどれかに割り当てる | `interest` 1語 |
| `Profiler` | 3層（トップ/ミドル/ボトム）を裏で推定する | 3つの短文 |

**LLM は会話を駆動しない。** ターンの進行、見込み度の判定、機能の選定、
事例照合はすべてコード側にある。仕様の「4往復を超えたら失敗」を守るには、
ターン制御を LLM に渡してはいけない。

> 補足: この構成では Agents SDK の自律ループ・tools・handoffs は v1 で使わない。
> 採用理由は「将来 `RealtimeAgent`（`gpt-realtime-2.1` + WebRTC）で音声を足すときに、
> 同一 SDK 内で移行でき、プロトタイプの TTS→再生→STT の往復レイテンシが構造的に消える」点にある。
> 音声を当面やらないなら `openai` v7 の Responses API 直叩き（依存1つ）でも十分足りる。

### 出力のホワイトリスト

`Narrator` の戻り値は `draft` のキー集合でしか上書きしない。
LLM が余計なキーや構造を返しても出力形状が壊れない。
JSON パースに失敗したら `draft` をそのまま使う。

### 全経路 degrade

どこが落ちても対話が止まらないこと。プロトタイプで実証済みの性質で、実装コストも低い。

| 障害 | 挙動 |
| ---- | ---- |
| `OPENAI_API_KEY` 未設定 | テンプレの `draft` をそのまま表示 |
| LLM が JSON を返さない | 同上 |
| 分類が失敗 | `topic`（何を配信すればいいか分からない）に倒す |
| 3層推定が失敗 | 3層を使わずに進む（提示物には出ないため実害が小さい） |
| 事前集計が無い業種 | 階段を降りる（§5）。最後まで無ければ「前例がない」と明示 |

---

## 5. 事例照合とフォールバック階段

仕様の照合キーは **業種 × 規模（`capital` / `ipo_type`） × PR内容（`keyword` / `release_type`）**。
プロトタイプは業種のみだったので、ここが最大の新規実装になる。

### 階段

3軸で絞ると件数が足りなくなる。**最小件数を満たす最初の段を採用する**。

| 段 | 軸 | 見込み度 |
| -- | -- | -------- |
| 1 | 業種 × 規模 × PR内容 | 事例が十分 |
| 2 | 業種 × PR内容 | 事例が少ない |
| 3 | 業種 × 規模 | 事例が少ない |
| 4 | 業種のみ | 事例が少ない |
| 5 | 該当なし | **事例がない** |

- 最小件数の初期値は **企業30社 かつ リリース200本**（実データで要調整・未決）
- **採用した段と件数を必ず提示物に含める**（「38社／214本」の表記はこのため）
- 段5 のときは「前例のない挑戦的な目標」と明示し、**軸を1段緩めた事例を必ず併記**する

これは `README.md` に未着手として残っていた
「業種だけで絞ったときの社数（フォールバックが何段目で止まるか）」への回答にあたる。
プロトタイプは業種のみで絞っていたため、小さい業種では全バケットが数社になり
当たり率が 0% や 100% に振れる状態だった。

### 集計は事前計算する

3軸の組み合わせをオンデマンドで集計するのは不可能。
プロトタイプの調査スクリプトは `statement_timeout` を150〜180秒に設定しており、
業種全件スキャンだけで数十秒〜数分かかる。

**バッチで事前集計し、アプリは集計済みテーブルだけを読む。**

```
pnpm metrics:build   → PR TIMES DB を集計 → app DB の peer_evidence に書き込む
```

| 何を | どこから | いつ |
| ---- | -------- | ---- |
| 事例照合（業種 × 規模 × PR内容の実績） | 事前集計テーブル（app DB） | バッチ |
| 企業の現在地（配信本数・停止月数・直近5本） | PR TIMES DB を直接 | 毎回（軽い） |
| 未使用機能の検出 | PR TIMES DB を直接 | 毎回（企業単位・軽い） |

プロトタイプのプロセス内 Map キャッシュ（TTL 30分）は ECS の複数タスクで無駄になるため使わない。

### 統計上の限界（合意しておきたい）

事例照合は相関であって因果ではない。
「N本出した企業の X% が当たり」は「当たった企業が出し続けた」でも説明できる（生存者バイアス）。
プロトタイプはシステムプロンプトの「断定しない。『差があります』と書き、『上がります』と書かない」で
対処していた。本実装でも同じ制約を維持する。

仕様の禁止事項「数値の裏付けがない断定」「事例がないのに『できます』と言うこと」と整合する。

---

## 6. 不変条件をコードで守る

仕様の禁止事項のうち、機械的に検証できるものはバリデータにする。
違反したら**1回だけ再生成**し、それでも駄目ならテンプレの `draft` に落とす。

| 不変条件 | 検証方法 |
| -------- | -------- |
| 質問だけのターンを作らない | `sections.length >= 1` |
| 1ターンに質問は1つ | `question.text` に「？」が1つ以下 |
| 数値の捏造をしない | 出力の数値トークンが `facts` / `draft` の数値集合に含まれること |
| マーケ用語を使わない | 禁止語リスト（KPI・ターゲット・リーチ・パーセンタイル 等）に当たらないこと |
| 一般論・励ましを書かない | 禁止フレーズリスト（「継続が大切」「長期的な視点」等） |
| 4往復を超えない | `turn <= 3` をドメインで強制。超える遷移を型で作れなくする |
| 実在しない機能を提案しない | 提案は `feature-catalog.ts` の定数からのみ選ぶ（LLM に選ばせない） |

数値検査は、プロトタイプの `modeltest.mjs` が
`MUST = { position: ['1','17'], lottery: ['87'], ... }` として手書きしていたものを、
**`draft` から数値トークンを自動抽出して照合する**形に一般化する。
これは CI に載せられる（LLM を呼ばない純関数として書ける）。

---

## 7. 永続化

app DB（このリポジトリがマイグレーションを持つ側）に置く。

```
pr_conversations
  id            uuid pk
  company_id    integer        -- PR TIMES 側の企業。外部キーは張らない（DB が別）
  status        enum('in_progress','completed','abandoned')
  turn          integer        -- 0..3
  interest      text null      -- ターン1で確定
  profile       jsonb null     -- 裏で推定した3層
  created_at / updated_at

pr_conversation_turns
  id               uuid pk
  conversation_id  uuid
  position         integer
  role             enum('agent','user')
  payload          jsonb       -- agent: TurnView / user: 選択と自由発話
  created_at
  unique (conversation_id, position)
```

### Agents SDK の `Session` は使わない

公式は自前 DB に履歴を持つなら `Session` インターフェースの実装を推奨しているが、
本設計では採らない。理由:

- 会話の正を**人間が読める形**で持ちたい。どんな関心が選ばれ、何を提示したかを後から分析する
- `AgentInputItem` をそのまま保存すると、上記の分析ができない
- `@openai/agents` は 0.15.0（0.x）で**マイナー更新にも破壊的変更が入る**。
  ベンダー固有のアイテム形式を DB スキーマに焼き込むのは避ける
- 本設計の LLM 呼び出しは毎回ステートレスな単発（`facts` + `draft` を渡すだけ）で、
  モデル側の会話履歴を必要としない

`package.json` では `@openai/agents` を**キャレットなしで完全固定**する。

---

## 8. HTTP 境界

トークンのストリーミングは v1 では入れない。1ターンの出力は構造化された提示物であり、
逐次描画の体感差が小さいわりに実装が増えるため。

| メソッド | パス | 用途 |
| -------- | ---- | ---- |
| POST | `/api/pr-agent/conversations` | 会話を開始し、ターン0 を返す |
| POST | `/api/pr-agent/conversations/[id]/answers` | 回答を渡し、次のターンを返す |

Server Actions は使わない。Next.js 16.3 のドキュメントに
「Server Actions are queued. Using them for data fetching introduces sequential execution」
「use a Route Handler for non-mutation requests」と明記されている。
加えて Server Actions は複数インスタンスで `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` の固定が必要になり、
ECS の複数タスク構成で運用が増える。Route Handler ならこの問題が発生しない。

### このバージョンの Next.js 固有の注意

`node_modules/next/dist/docs/` の実物を読んで確認した、学習データと食い違う点。

- `export const runtime = 'edge'` は**非推奨**。`runtime` の export ごと書かない（既定が nodejs）
- 動的セグメントの `params` は **Promise**。`RouteContext<'/api/pr-agent/conversations/[id]'>`
  というグローバル型ヘルパー（import 不要・typegen 生成）が推奨形
- `fetch` は**デフォルトでキャッシュされない**（`Caching is opt-in`）
- POST の Route Handler は常に非キャッシュ。GET で LLM を呼ぶと意図せず固定化される危険がある
- `export const dynamic = 'force-dynamic'` は動くが「Previous Model」扱い。
  将来 `cacheComponents: true` にすると削除対象。既存の `src/app/api/health/route.ts` も同じ状態

---

## 9. 未決事項

### (a) PR TIMES データベースへの接続 — 最重要

現状このリポジトリの接続は2本だけ。

| 環境変数 | 中身 | 所有 |
| -------- | ---- | ---- |
| `APP_DATABASE_URL` | `agents` / `settings` | このアプリ |
| `STATS_DATABASE_URL` | `agent_daily_stats` | 外部・参照専用 |

**PR TIMES のデータ（`company` / `release` / `release_statistic` / `release_keyword` /
`release_type` / `industry`）はどちらにも無い。** プロトタイプは独自の `DATABASE_URL` で
RDS に直接繋いでいた。

案は2つ。

1. **`stats` の枠を PR TIMES DB として使う** — 「外部・参照専用・マイグレーションを流さない」という
   役割が完全に一致する。`compose.yaml` の `stats-db` も参照専用ロール `stats_reader` で
   繋ぐ形になっており、そのまま使える。既存の `agent_daily_stats` は骨組みのプレースホルダなので捨てる
2. **3本目の接続 `PRTIMES_DATABASE_URL` を足す** — `stats` を温存できるが、接続の種類が増える

**推奨は 1。** `src/external/db/connection.ts` は接続キー付きのレジストリなので、
どちらでも構成は増えないが、役割が重複した接続を2本持つ理由がない。

いずれの場合も `drizzle-kit pull` でスキーマを引く（`pnpm db:stats:pull` が既にある）。
ローカルは `docker/stats-db/init.sql` を PR TIMES 相当のスキーマに差し替える必要がある。

### (b) 対象企業の特定方法

認証がまだ無い。プロトタイプは `?company=` と `DEFAULT_COMPANY_ID` で任意の企業の
内部データを引ける状態だったが、これはデモだから成立していた割り切りで、そのまま持ち込めない。

当面の案: 企業を選ぶ画面を明示的に「デモ用」として分離し、
`feature` 側は常に「確定した企業ID」を引数で受け取る形にしておく。
認証が入ったときに `app` 層だけを差し替えれば済む。

### (c) 仕様に対してデータが足りるか

システムプロンプトが要求していて、プロトタイプが**触っていない**カラムがある。

| 仕様の要求 | 必要なもの | プロトタイプ |
| ---------- | ---------- | ------------ |
| 規模で照合 | `company.capital` / `ipo_type` | `capital` は SELECT しているが未使用 |
| リード文の未使用検出 | `release.lead_paragraph` | 未使用 |
| 複数カテゴリの検出 | `release_business_category` | 未使用 |
| 地域指定の検出 | `release_location` | 未使用 |
| メディア転載率 | `webclipping_list` | **「差がつかない」と判断して指標から除外済み** |

最後の1点が重要。プロトタイプの調査で
「メディア転載はほぼ全リリースで発生するため『転載率』では差がつかない」という結論が出ている。
一方システムプロンプトの出力例は「メディア転載が起きる割合は、1本目5% → 6本目28%」を
主要な数値として使っている。**どちらが正しいかは実データで再確認が必要。**
差がつかないなら、プロトタイプが採用した「業種内 PV 上位10% に届いた企業の割合」に
読み替えることになる。

`ipo_type` / `lead_paragraph` / `release_business_category` / `release_location` の
実在と充足率も未確認。

### (d) モデルとコスト

- 文章化（`Narrator`）: `gpt-5.6-luna`（Agents SDK の既定）+ `reasoning.effort: 'low'`
- 分類（`Classifier`）: `gpt-5.4-nano` + `reasoning.effort: 'none'`
- 3層推定（`Profiler`）: `Narrator` と同じ

いずれも環境変数で差し替え可能にし、モデルを並べて比較できるようにする
（プロトタイプの `modeltest.mjs` に相当するものを CI に置く）。

**料金は未確認。** 調査時に OpenAI の料金ページへ到達できなかったため、
モデルIDの正確さは公式 SDK の型定義で裏取りできているが、単価は確認が必要。

### (e) 「模擬データ」表記の扱い

出力例に `（模擬データ）` が入っている。実データに切り替わったら消える表記なので、
提示物のスキーマに `source: 'mock' | 'measured'` を持たせ、
**表記そのものを LLM に書かせない**（コードが付与する）。

---

## 10. 実装の順序

1. PR TIMES DB への接続を決め、`drizzle-kit pull` でスキーマを引く（(a) の決着が前提）
2. `feature/pr-metrics` — 事例照合の階段と未使用機能の検出。LLM を含まないので単体で検証できる
3. 事前集計バッチ（`pnpm metrics:build`）
4. `feature/pr-agent` の domain / application — 状態機械と不変条件。**ここまで LLM 無しで動く**
5. `infrastructure` の LLM 実装3つ（`Narrator` / `Classifier` / `Profiler`）
6. Route Handler と画面

4 の時点でテンプレのまま対話が最後まで通ることを確認してから 5 に進む。
degrade の経路（キー未設定でも動く）がそのまま開発順序になる。
