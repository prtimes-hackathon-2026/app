# 広報伴走エージェント — バックエンド設計

PR TIMES を使ったが配信が止まっている中小企業の担当者に対し、
**対話を通じて「次の1本」を確定させる**画面と、その裏側のエージェント基盤の設計。

`voice-agent/` のプロトタイプで実データ検証済みの指標を、本体アプリの機能として作り直す。

## 決まったこと

| 論点 | 決定 |
| ---- | ---- |
| LLM ライブラリ | OpenAI Agents SDK（`@openai/agents`） |
| 指標 | voice-agent の5指標をすべて移植する |
| ストリーミング | v1 では入れない |
| PR TIMES DB | **`stats` 接続を PR TIMES DB として使う** |
| 仕様が食い違ったとき | **プロトタイプの実データ検証結果を優先する** |

---

## 1. 「プロトタイプを優先する」が意味すること

システムプロンプトの出力例には、**実データと矛盾する数値**が含まれている。
プロトタイプは 2026-08-13 に prtimes RDS を実測しており、そちらを正とする。

| システムプロンプトの例 | 実測（`voice-agent/src/metrics.js`） | 採否 |
| ---------------------- | ------------------------------------ | ---- |
| 1本目のPV中央値 820 → 6本目 1,340（1.6倍） | **PVの中央値は本数を重ねても伸びない**（情報通信で 13 → 12 で横ばい） | **使わない** |
| メディア転載率 1本目5% → 6本目28% | **転載はほぼ全リリースで発生するため転載率では差がつかない** | **使わない** |
| — | PVのばらつきが極端（中央値25 / 上位10%=128 / 上位1%=1,487） | 採用 |
| — | 当たり率 1本17% → 3本29% → 6〜10本47% → 21本以上87% | **中心指標** |

したがって中心指標は
**「配信本数別に、業種内PV上位10%に届いた企業の割合」**（当たり率カーブ）。

「1本ごとが**くじ**であり、本数を重ねるほど当たりを引く確率が上がる」という言い方になる。
「1本あたりの反応が良くなる」ではない。ここを取り違えると全部の文章が嘘になる。

### 照合軸は v1 では業種のみ

システムプロンプトは `業種 × 規模（capital / ipo_type） × PR内容` の3軸を要求しているが、
プロトタイプの `README.md` は `capital` の分布と業種だけで絞ったときの社数を
**未確認事項として残している**。3軸に絞ると件数が枯れる段が読めない。

v1 は**プロトタイプと同じ業種軸のみ**で実装し、フォールバック階段は §7 に拡張点として記録する。
実データに繋いだ時点で `capital` の分布を確認してから足す。

### ターン構成

プロトタイプは**2ターン**（0 と 1）。システムプロンプトは「最初の一手を確定する」ターンを求めている。
プロトタイプの2ターンを土台に、確定ターンを1つ足した**3ターン**とする（4往復以内に収まる）。

| ターン | 出す事実 | 問い |
| ------ | -------- | ---- |
| 0 | 現在地・当たり率カーブ・再開した企業・未使用機能 | 関心を4択（+その他） |
| 1 | 目標本数・時間では上がらないこと・種別の傾向・使うとよい機能と記事 | この方向で進めるか |
| 2 | 最初の一手を1つ | なし（終端） |

### 守る不変条件

1. **質問だけのターンを作らない** — 毎ターン、相手が知らなかった事実を1つ以上返す
2. **抽象的な目的を聞かない** — ラダリング（「なぜ」「それが実現したら」）は使わない
3. **3層（トップ/ミドル/ボトム）は裏で推定するだけ** — 相手には質問しない
4. **達成できない目標は達成できないと言う**
5. 相関を因果として語らない — 「差があります」と書き、「上がります」と書かない

1・2・5 はコードで機械的に検証する（§6）。

---

## 2. Notion の「目的の抽出」との矛盾（未決）

Notion の
[目的の抽出ページ](https://app.notion.com/p/3bb5cf8421b680af81dfedfd8e14dd3a)
には、これと正反対の対話設計が書かれている。

| 論点 | Notion「目的の抽出」 | 本設計 |
| ---- | -------------------- | ------ |
| 質問形式 | 自由回答のオープンクエスチョン | 選択肢を提示して選ばせる |
| ラダリング | 積極的に使う | **使わない** |
| 目的の階層 | 対話して3階層を作る | **裏で推定するだけ** |
| ターン数 | 完成サンプルで17問 | **3ターン** |
| 言い換え確認 | 「〜という理解で合っていますか？」が型 | **情報量ゼロとして使わない** |

Notion 側が古い検討過程なのか、別機能として残すのかは未決。
（Notion の2日目振り返りに「抽象的な議論を続けてきたこともあり、具体的に技術的な処理方法を
検討する中で認識の違いに気づくことがありました」とあり、転換自体は記録されている）

---

## 3. レイヤー構成

`README.md` の依存方向（`app → feature → external`、`shared` は末端）に従う。
`eslint.config.mjs` が機械的に強制しており、特に
**`domain` / `application` は `next` / `react` / `drizzle-orm` / `postgres` を import できない**。

`@openai/agents` も同じ扱いにする。**LLM はポートとして抽象化し、実装は `infrastructure` に置く**。

```
src/
├── app/
│   ├── pr-agent/page.tsx                          画面
│   └── api/pr-agent/
│       ├── conversations/route.ts                 POST ターン0
│       └── conversations/[id]/answers/route.ts    POST ターン1〜2
│
├── feature/
│   ├── pr-agent/                                  対話の進行
│   │   ├── domain/
│   │   │   ├── conversation.ts        会話・ターン・状態遷移（0→1→2 のみ）
│   │   │   ├── turn.ts                1ターンの提示物（blocks + narrative + question）
│   │   │   ├── interest.ts            4つの関心
│   │   │   ├── narrator.ts            ポート: 下書き→文章
│   │   │   ├── classifier.ts          ポート: 自由発話→4分類
│   │   │   ├── profiler.ts            ポート: 3層の推定
│   │   │   ├── company-facts.ts       ポート: 事実の取得（pr-metrics への窓口）
│   │   │   └── conversation-repository.ts
│   │   ├── application/
│   │   │   ├── start-conversation.ts  ターン0
│   │   │   ├── answer-interest.ts     ターン1
│   │   │   ├── confirm-plan.ts        ターン2
│   │   │   └── validate-narrative.ts  不変条件の検証（§6）
│   │   ├── infrastructure/
│   │   │   ├── narrator.openai.ts
│   │   │   ├── classifier.openai.ts
│   │   │   ├── profiler.openai.ts
│   │   │   ├── company-facts.pr-metrics.ts
│   │   │   └── conversation-repository.drizzle.ts
│   │   └── index.ts
│   │
│   └── pr-metrics/                                指標。SQL はここにしか無い
│       ├── domain/
│       │   ├── bucket.ts              配信本数のバケット（1本/2本/…/21本以上）
│       │   ├── hit-curve.ts           当たり率カーブ
│       │   ├── resume.ts              休止から再開した企業
│       │   ├── trend.ts               種別ごとの傾向
│       │   ├── lever.ts               打ち手ごとの効果差分
│       │   ├── unused-feature.ts      未使用機能の検出ルール
│       │   ├── feature-catalog.ts     機能カタログとマガジン記事
│       │   └── metrics-repository.ts  ポート
│       ├── application/
│       │   ├── get-company-position.ts
│       │   ├── get-peer-evidence.ts
│       │   └── detect-unused-features.ts
│       ├── infrastructure/
│       │   └── metrics-repository.drizzle.ts
│       └── index.ts
│
├── external/
│   ├── db/stats/schema/prtimes.ts     company / release / release_statistic ほか
│   └── openai/client.ts               Runner の生成（プロセスで1つ）
│
└── shared/env.ts                      OPENAI_API_KEY を追加
```

`pr-agent` から `pr-metrics` は**公開 API 経由でのみ**呼ぶ。
ESLint は `@/feature/*/*`（内部）を禁じるが `@/feature/pr-metrics`（index）は許可しており、
設定のメッセージも「必要なら `@/feature/<domain>` の公開 API を使うこと」と明示している。
ただし `domain` / `application` は他 feature も直接呼ばず、`CompanyFacts` ポート越しにする。

---

## 4. LLM の役割を限定する

プロトタイプで最も効いていた設計判断を、そのまま引き継ぐ。

```
数値・判定・機能選定 … SQL とドメインルール（決定的）
文章                 … LLM（下書きを言い換えるだけ）
```

LLM に渡すのは**日本語ラベルの辞書**と**テンプレの下書き**だけ。
生の指標名（`eval_point` 等）を渡すと意味を誤読するため、
**指標の定義そのものをキーにする**。

```jsonc
{
  "facts": {
    "御社の配信本数": "1本",
    "停止期間": "12か月",
    "同じ業種の企業数": "4,291社",
    "御社と同じ本数の企業が当たりを引いた割合": "17%",
    "最も多く配信している企業群の当たり率": "87%（21本以上）",
    "手応えのある結果の基準": "128PV以上（業種内の上位10%）",
    "再開前の当たり率": "9%",
    "再開後の当たり率": "44%"
  },
  "draft": {
    "position": "御社は1本で止まっています。…",
    "lottery": "1本あたりの反応は本数を重ねても平均は変わりませんが、…",
    "resume": "同じく1本で止まっていた企業のうち、4,291社が配信を再開しています。…"
  }
}
```

LLM の仕事は3つだけ。

| ポート | 役割 | 出力 |
| ------ | ---- | ---- |
| `Narrator` | `draft` を、その会社の商品に即した言葉に書き直す | `draft` と同じキーの JSON |
| `Classifier` | 自由発話を4つの関心のどれかに割り当てる | `interest` 1語 |
| `Profiler` | 3層（トップ/ミドル/ボトム）を裏で推定する | 3つの短文 |

**LLM は会話を駆動しない。** ターンの進行、目標の算出、機能の選定、事例照合はすべてコード側。
「4往復を超えたら失敗」を守るには、ターン制御を LLM に渡してはいけない。

### 出力のホワイトリスト

`Narrator` の戻り値は `draft` のキー集合でしか上書きしない。
LLM が余計なキーを返しても出力形状が壊れない。パースに失敗したら `draft` をそのまま使う。

### 全経路 degrade

プロトタイプは「DBもキーも無しで動く」ことを実証している。同じ性質を維持する。

| 障害 | 挙動 |
| ---- | ---- |
| `OPENAI_API_KEY` 未設定 | テンプレの `draft` をそのまま表示 |
| LLM が JSON を返さない | 同上 |
| 分類が失敗 | `topic`（何を配信すればいいか分からない）に倒す |
| 3層推定が失敗 | 3層を使わずに進む（提示物に出ないため実害が小さい） |
| PR TIMES DB 未接続 | 模擬データで動く（プロトタイプの `mock.js` 相当） |

> 補足: Agents SDK の自律ループ・tools・handoffs は v1 で使わない。
> 採用理由は「将来 `RealtimeAgent` で音声を足すときに同一 SDK 内で移行でき、
> プロトタイプの TTS→再生→STT の往復レイテンシが構造的に消える」点にある。

---

## 5. 指標（すべてプロトタイプから移植）

SQL は `feature/pr-metrics/infrastructure` にしか置かない。

| 指標 | 内容 | 実測値の例（情報通信） |
| ---- | ---- | ---------------------- |
| 当たり率カーブ | 配信本数別に、業種内PV上位10%に届いた企業の割合 | 1本17% → 21本以上87% |
| 期間カーブ | 初回配信からの経過期間別の当たり率 | 3年経っても13%→23%。**時間では上がらない** |
| 種別の傾向 | `release_type` ごとの PV 中央値・上位10% | 最も多い種別は埋もれる |
| 再開統計 | 6か月以上休止してから再開した企業の前後比較 | 4,291社が再開・9%→44%・追加中央値3本 |
| 効果差分 | 打ち手の有無での当たり率の差 | メイン画像 10.3%/4.4%、キーワード 10.8%/6.3% |

期間カーブは**当たり率カーブと対にして使う**。
「本数では 17%→87% に上がるが、時間では 13%→23% にしかならない」を並べて初めて、
「時間ではなく本数」という主張が成立する。片方だけでは意味がない。

### 未使用機能の検出

企業単位・軽いクエリ。検出したものと効果差分の両方が当たる機能を最優先で提案する。

| データの状態 | 未使用と判定する機能 |
| ------------ | -------------------- |
| `release_keyword` の平均が3件未満 | キーワード設定 |
| `main_image` が全件 NULL/空 | メイン画像 |
| `subtitle` が全件 NULL/空 | サブタイトル |
| `youtube_url` が全件 NULL/空 | 動画の掲載 |
| `title` に数字が1本も無い | タイトルに数字を入れる |
| `title` に【】が1本も無い | タイトルの【】 |
| `release_type_id` が1種類のみ かつ 2本以上 | リリース種別の使い分け |

機能カタログは公式サイト / PR TIMES MAGAZINE で実在を確認した機能のみ。
**LLM に機能を選ばせない**（定数から選ぶ）。実在しない機能の提案が構造的に起きない。

### 集計の重さ

業種全件スキャンは重い。プロトタイプの調査スクリプトは `statement_timeout` を150〜180秒にしていた。

プロトタイプはプロセス内 Map（TTL 30分）でキャッシュしていたが、ECS の複数タスクでは無駄になる。
**app DB にキャッシュテーブルを持つ**（業種ID + 指標 JSONB + 計算時刻、TTL で再計算）。

| 何を | どこから | いつ |
| ---- | -------- | ---- |
| 業種単位の5指標 | PR TIMES DB → app DB にキャッシュ | 初回参照時 + TTL |
| 企業の現在地・未使用機能 | PR TIMES DB を直接 | 毎回（軽い） |

### 統計上の限界（合意しておきたい）

当たり率カーブは相関であって因果ではない。
「21本出した企業の87%が当たり」は「当たった企業が出し続けた」でも説明できる（生存者バイアス）。
プロトタイプは「断定しない」で対処していた。本実装でも維持する（§6 で機械検査する）。

---

## 6. 不変条件をコードで守る

違反したら**1回だけ再生成**し、それでも駄目ならテンプレの `draft` に落とす。

| 不変条件 | 検証方法 |
| -------- | -------- |
| 質問だけのターンを作らない | `blocks.length >= 1` |
| 1ターンに質問は1つ | `question.text` に「？」が1つ以下 |
| 数値の捏造をしない | 出力の数値トークンが `facts` / `draft` の数値集合に含まれること |
| 因果として語らない | 「上がります」「増えます」等の断定表現に当たらないこと |
| マーケ用語を使わない | 禁止語リスト（KPI・ターゲット・リーチ・パーセンタイル 等） |
| 一般論・励ましを書かない | 禁止フレーズリスト（「継続が大切」「長期的な視点」等） |
| 3ターンを超えない | 状態遷移を型で閉じる |
| 実在しない機能を提案しない | 提案は `feature-catalog.ts` の定数からのみ選ぶ |

数値検査は、プロトタイプの `modeltest.mjs` が
`MUST = { position: ['1','17'], lottery: ['87'], … }` と手書きしていたものを、
**`draft` から数値トークンを自動抽出して照合する**形に一般化する。
LLM を呼ばない純関数として書けるので CI に載る。

---

## 7. 拡張点（v1 では作らない）

実データに繋いで `capital` の分布を確認してから着手する。

**照合軸を3軸にしたときのフォールバック階段。** 業種 × 規模 × PR内容で絞ると件数が枯れるため、
最小件数を満たす最初の段を採用し、採用した段と件数を必ず提示物に含める。

| 段 | 軸 | 見込み度 |
| -- | -- | -------- |
| 1 | 業種 × 規模 × PR内容 | 事例が十分 |
| 2〜4 | いずれかを外す | 事例が少ない（幅で提示し件数を明示） |
| 5 | 該当なし | **前例のない挑戦的な目標**。1段緩めた事例を必ず併記 |

プロトタイプは業種のみで絞っていたため、小さい業種では全バケットが数社になり
当たり率が 0% や 100% に振れる状態だった。最小件数の閾値もここで決める。

---

## 8. 永続化

app DB（このリポジトリがマイグレーションを持つ側）。

```
pr_conversations
  id            uuid pk
  company_id    integer        -- PR TIMES 側。外部キーは張らない（DB が別）
  status        'in_progress' | 'completed' | 'abandoned'
  turn          integer        -- 0..2
  interest      text null      -- ターン1で確定
  profile       jsonb null     -- 裏で推定した3層
  created_at / updated_at

pr_conversation_turns
  id               uuid pk
  conversation_id  uuid
  position         integer
  role             'agent' | 'user'
  payload          jsonb
  created_at
  unique (conversation_id, position)

pr_industry_metrics                 -- 業種単位の集計キャッシュ（§5）
  industry_id   integer pk
  metrics       jsonb
  computed_at   timestamptz
```

### Agents SDK の `Session` は使わない

公式は自前 DB に履歴を持つなら `Session` の実装を推奨しているが、採らない。

- 会話の正を**人間が読める形**で持ちたい。どんな関心が選ばれ何を提示したかを後から分析する
- `AgentInputItem` をそのまま保存すると、その分析ができない
- `@openai/agents` は 0.x でマイナー更新にも破壊的変更が入る。
  ベンダー固有のアイテム形式を DB スキーマに焼き込むのは避ける
- 本設計の LLM 呼び出しは毎回ステートレスな単発で、モデル側の会話履歴を必要としない

`package.json` では `@openai/agents` を**キャレットなしで完全固定**する。

---

## 9. HTTP 境界

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

`node_modules/next/dist/docs/` の実物で確認した、学習データと食い違う点。

- `export const runtime = 'edge'` は**非推奨**。`runtime` の export ごと書かない（既定が nodejs）
- 動的セグメントの `params` は **Promise**。`RouteContext<'/api/…/[id]'>` というグローバル型ヘルパー
  （import 不要・typegen 生成）が推奨形
- `fetch` は**デフォルトでキャッシュされない**（`Caching is opt-in`）
- POST の Route Handler は常に非キャッシュ。GET で LLM を呼ぶと意図せず固定化される危険がある
- `export const dynamic = 'force-dynamic'` は動くが「Previous Model」扱い。
  将来 `cacheComponents: true` にすると削除対象

---

## 10. `stats` 接続を PR TIMES DB にすることの影響

`STATS_DATABASE_URL` が PR TIMES DB を指す。役割（外部・参照専用・マイグレーションを流さない）は
そのまま一致するので、接続の構成は変えない。

スキーマはプロトタイプの SQL から起こす。**`release_statistic` / `release_keyword` は
`(company_id, release_id)` の複合キー**である点に注意（プロトタイプの JOIN 条件がそうなっている）。

```
company            company_id, company_name, industry_id, capital, foundation_date, description
industry           industry_id, industry_name
release            company_id, release_id, title, subtitle, main_image, youtube_url,
                   release_type_id, created_at
release_statistic  company_id, release_id, page_view
release_keyword    company_id, release_id
release_type       release_type_id, release_type_name
```

**実接続で `pnpm db:stats:pull` して差分を確認すること。**
このセッションでは DB 認証情報も Docker も無く、実スキーマの照合ができていない。

### 副作用（要判断）

既存の `agent_daily_stats` テーブルと `feature/stats` は、
PR TIMES DB には存在しないテーブルを参照することになる。
**削除はせず残してある**（型は通るが実行時に落ちる）。骨組みのサンプルなので、
不要なら別途削除する。ローカル開発用の `docker/stats-db/init.sql` には
PR TIMES 相当のテーブルを追加し、`agent_daily_stats` はそのまま残す。

---

## 11. 未決事項

### (a) 対象企業の特定方法

認証がまだ無い。プロトタイプは `?company=` と `DEFAULT_COMPANY_ID` で
任意の企業の内部データを引ける状態だったが、これはデモだから成立していた割り切り。

当面は企業を選ぶ画面を明示的に「デモ用」として分離し、`feature` 側は常に
「確定した企業ID」を引数で受け取る形にしておく。認証が入ったら `app` 層だけ差し替える。

### (b) 実データで確認すること（プロトタイプの積み残し）

- `release_type` の実際の値（傾向テーブルの中身が決まる）
- `capital` の分布（規模バンドの刻み → §7 の前提）
- 業種だけで絞ったときの社数（フォールバックが何段目で止まるか）
- `ipo_type` / `lead_paragraph` / `release_business_category` / `release_location` の実在と充足率
  （プロトタイプが一度も触っていない）

### (c) モデルとコスト

- 文章化（`Narrator`）: `gpt-5.6-luna` + `reasoning.effort: 'low'`
- 分類（`Classifier`）: `gpt-5.4-nano` + `reasoning.effort: 'none'`
- 3層推定（`Profiler`）: `Narrator` と同じ

環境変数で差し替え可能にする。**料金は未確認**（調査時に料金ページへ到達できなかった）。
モデルIDの正確さは公式 SDK の型定義で裏取り済み。

---

## 12. 実装の順序

1. `external/db/stats/schema/prtimes.ts` — プロトタイプの SQL からスキーマを起こす
2. `feature/pr-metrics` — 指標。LLM を含まないので単体で検証できる
3. `feature/pr-agent` の domain / application — 状態機械と不変条件。**ここまで LLM 無しで動く**
4. `infrastructure` の LLM 実装3つ（`Narrator` / `Classifier` / `Profiler`）
5. Route Handler と画面

3 の時点でテンプレのまま3ターンが通ることを確認してから 4 に進む。
degrade の経路（キーが無くても動く）がそのまま開発順序になる。
