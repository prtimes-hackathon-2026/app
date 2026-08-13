# app

Next.js (App Router) のアプリケーション。ルーティング・ドメイン実装・外部接続を
レイヤーで分離した骨組みと、管理画面の共通レイアウトを用意している。

## ディレクトリ構成

```
src/
├── app/                     ルーティングと HTTP 境界だけ。ビジネスロジックを置かない
│   ├── api/health/route.ts
│   └── (dashboard)/         管理画面。AppShell を共有するルートグループ
├── feature/                 ドメインごとの縦割り実装
│   ├── agents/
│   │   ├── domain/          型とポート(interface)。フレームワーク・ORM 非依存
│   │   ├── application/     ユースケース。ポートだけに依存する
│   │   ├── infrastructure/  ポートの実装 (Drizzle アダプタ)
│   │   └── index.ts         この feature の合成ルート兼公開 API
│   ├── settings/
│   └── stats/               統計 DB からの読み取り
├── external/                外部システムへの接続。ドメインを知らない
│   └── db/
│       ├── connection.ts    postgres.js の接続プール生成 (共通)
│       ├── app/             このアプリが所有する DB (AWS RDS)
│       └── stats/           統計情報用の外部 PostgreSQL (参照専用)
└── shared/                  横断的な部品。他レイヤーに依存しない
    ├── env.ts               環境変数の検証 (zod)
    ├── app-config.ts        画面に流し込む値 (ロゴ・メニュー・窓口・アカウント)
    └── ui/                  画面部品。ドメインを知らない
```

依存の向きは一方向に固定している。

```
app  ->  feature  ->  external
           |             |
           +--> shared <-+
```

この向きは ESLint の `no-restricted-imports` で機械的に強制している
(`eslint.config.mjs` の `layerBoundaries`)。破ると `pnpm lint` が落ちる。

- `app` から `external` を直接触れない → 必ず `@/feature/<domain>` の公開 API 経由
- `app` は feature の内部 (`@/feature/agents/domain/...`) を import できない
- `domain` / `application` は `next` / `react` / `drizzle-orm` / `postgres` を import できない
- feature 同士は互いの内部に触れない
- `external` は feature と app を知らない

## 画面 (`src/shared/ui`)

管理画面の見た目は「同じものを二度書かない」ことを最優先に組んでいる。
CSS フレームワークは入れず、Next.js 標準の CSS Modules と CSS 変数だけで完結させている。

```
src/shared/ui/
├── styles/tokens.css   色・余白・文字サイズ・レイアウト寸法の定義 (唯一の生の値)
├── styles/base.css     リセットと素の HTML の既定値
├── icon/               アイコン。24x24 の線画をこの 1 ファイルに集約
├── button/             Button / LinkButton / IconButton
├── card/               Card / CardHeader / CardBody / CollapsibleCard
├── page/               PageHeader / Breadcrumb
├── stat/               StatGrid / StatTile
├── layout/             Stack (縦積み)
├── app-shell/          ヘッダー・サイドバー・パンくず・FAB の骨組み
└── index.ts            公開 API。使う側は `@/shared/ui` からだけ import する
```

共通化の要は次の 3 つ。

1. **トークン** — 色や余白の生の値を書いてよいのは `tokens.css` だけ。
   他は必ず `var(--c-*)` `var(--s-*)` を参照するので、配色の変更が 1 ファイルで済む。
2. **`AppShell`** — ヘッダー・サイドバー・本文の位置関係を持つのはここだけ。
   `src/app/(dashboard)/` に置いたページは自動でこの骨組みを共有する。
3. **設定の外出し** — 何を並べるかは `src/shared/app-config.ts` が持つ。
   メニューを増やす・ロゴを変える・窓口を差し替える変更はこのファイルだけで完結し、
   `@/shared/ui` 側は「どんな項目が来ても並べられる」ことだけを担当する。

パンくずと、サイドバーのどのメニューを開くか・どこを選択中にするかは、
すべて `app-config.ts` の `navigation` と現在の URL から自動で決まる (`findNavTrail`)。
ページ側がパンくずを書くことはない。

ページを足すときは `src/app/(dashboard)/<path>/page.tsx` を作り、
`navigation` に項目を足すだけでよい。まだ中身が無い URL は
`src/app/(dashboard)/[...slug]/page.tsx` が見出しだけを出す。
`navigation` に無い URL はここで 404 になる。

なお `/` は DB 疎通確認用のページのままにしてある。管理画面の入口は `/dashboard`。

## ORM: Drizzle ORM

2 つの DB を扱う要件から Drizzle を選定した。

- **接続が 2 本でも構成が増えない** — Drizzle の「DB クライアント」は
  `drizzle(sql, { schema })` を作るだけで、スキーマもクライアントも接続ごとに独立して持てる。
  Prisma は DB ごとに schema ファイルと生成クライアントを分ける必要があり、
  生成物の出力先やインポート経路の管理が増える。
- **管理外の DB を「読むだけ」で扱える** — 統計 DB はこのアプリの管理外なので、
  マイグレーションを持たず `drizzle-kit pull` で実体からスキーマを引くだけにできる。
  設定ファイルを DB ごとに分けているので、統計 DB に対して `migrate` を打つ事故も起きにくい。
- **コード生成なしで型が付く** — スキーマ定義そのものが型なので、ビルド前に生成ステップを
  挟まずに済み、Docker のマルチステージビルドが単純になる。
- 生成されるのは素の SQL に近く、レイヤー境界 (infrastructure だけが ORM を知る) を保ちやすい。

ドライバは `postgres` (postgres.js)。接続プールとタイムアウトは
`src/external/db/connection.ts` に集約している。

## 2 つのデータベース

|                      | 所有者     | 用途                                    | マイグレーション               |
| -------------------- | ---------- | --------------------------------------- | ------------------------------ |
| `APP_DATABASE_URL`   | このアプリ | アプリのデータ (AWS RDS for PostgreSQL) | このリポジトリから流す         |
| `STATS_DATABASE_URL` | 外部       | 統計情報の参照                          | **流さない** (introspect のみ) |

環境変数は `src/shared/env.ts` で zod により検証する。検証は初回アクセス時の遅延評価なので、
DB が無い環境 (CI の `next build` など) でもビルドは通る。

## セットアップ

```bash
cp .env.example .env
pnpm install
pnpm dev
```

## コマンド

| コマンド                                 | 内容                                                |
| ---------------------------------------- | --------------------------------------------------- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js                                             |
| `pnpm check`                             | lint → format:check → typecheck → build (CI と同じ) |
| `pnpm db:app:generate`                   | アプリ DB のマイグレーション SQL を生成             |
| `pnpm db:app:migrate`                    | アプリ DB にマイグレーションを適用                  |
| `pnpm db:app:check`                      | マイグレーションが base ブランチと矛盾しないか確認  |
| `pnpm db:app:studio`                     | Drizzle Studio                                      |
| `pnpm db:stats:pull`                     | 統計 DB を introspect してスキーマを引き直す        |

## マイグレーション

スキーマを変えたら `pnpm db:app:generate` で SQL を生成し、**生成物ごとコミットする**。
適用は手で流す必要はなく、**サーバーの起動時に自動で流れる**。

### 起動時に流す

`src/instrumentation.ts` の `register()` から `migrateAppDbOnStartup()` を呼んでいる。
Next.js はサーバーインスタンスごとに 1 度だけ、**リクエストを受け付ける前に**これを実行する。
失敗すれば例外がそのまま出てサーバーは起動しない (ECS では deployment circuit breaker が
旧タスクへ切り戻す)。

| 環境                             | 既定     |
| -------------------------------- | -------- |
| `NODE_ENV=production` (コンテナ) | 流す     |
| それ以外 (`pnpm dev` など)       | 流さない |

`APP_DATABASE_MIGRATE_ON_STARTUP=true` / `=false` で明示的に上書きできる。dev で流さないのは、
DB を用意していない環境でもサーバーが起動できるようにするため (環境変数の遅延検証と同じ理由)。
手元で試すなら `docker compose up` が `NODE_ENV=production` なのでそのまま流れる。

同時に複数のタスクが起動しても二重に流れないよう、`pg_advisory_lock` で 1 つに絞っている。
アプリ本体の接続プールとは別に専用の接続を 1 本張るのはそのため (セッション単位のロックは
取得した接続に紐づく)。SQL とジャーナルは `.next/standalone` に含まれないので、`Dockerfile`
の `runner` ステージで `drizzle/app/migrations` を明示的にコピーしている。

### 番号の衝突を CI で止める

同じ時期に切った 2 本のブランチがそれぞれ `0001_*` を生成すると、先にマージされた方に
番号を取られる。そのまま流すと片方が飛ばされたりスナップショットの連鎖が切れたりするため、
CI の `migrations` ジョブで次を確認している (DB には接続しない)。

- `pnpm db:app:generate` の結果に差分が出ないか (= generate 忘れ)
- base ブランチのマイグレーションが、このブランチにそのまま残っているか (= 番号の衝突)
- マージ済みのマイグレーションが書き換えられていないか
- スナップショットの `prevId` が繋がっているか

衝突したら base を取り込み、生成した SQL とスナップショットを消してから
`pnpm db:app:generate` をやり直す。手元でも `pnpm db:app:check origin/main` で確認できる。

## Docker

```bash
docker compose up --build
curl http://localhost:3000/api/health
```

- `app` — `Dockerfile` の `runner` ステージ。Next.js の `output: 'standalone'` を使い、
  非 root ユーザーで起動する
- `app-db` — ローカルでの AWS RDS の代役
- `stats-db` — ローカルでの外部統計 DB の代役。スキーマは
  `docker/stats-db/init.sql` で用意し、アプリは参照専用ロール `stats_reader` で接続する

`/api/health` は liveness チェックなので意図的に DB を見ない。DB を含む readiness が必要に
なったら feature 側にユースケースを足し、`app` からはその公開 API を呼ぶだけにする。

## PR プレビュー

PR を開くと `https://pr-<番号>.preview-prtimes-hackathon-2026.naohanpen.dev` が生えて、
URL が PR にコメントされる。push のたびに入れ替わり、PR を閉じると消える。
インフラ側の作りは infra リポジトリの `docs/pr-preview.md` にある。

| ファイル                                  | 役割                                  |
| ----------------------------------------- | ------------------------------------- |
| `.github/workflows/preview.yml`           | 登録と削除の中身 (reusable workflow)  |
| `.github/workflows/preview-cleanup.yml`   | PR が閉じたら消す                     |
| `.github/workflows/preview-reconcile.yml` | 夜間に open な PR だけへ揃え直す      |
| `.github/scripts/preview-tfc.sh`          | Terraform Cloud の変数更新と run 起動 |

登録は `docker-publish.yml` の `preview` ジョブが `needs: build` 付きで呼ぶ。別ワークフローに
すると同じ `pull_request` イベントから独立に起動してしまい、イメージの publish より先に
Terraform が走って、まだ無いタグを pull しようとしてタスクが起動しない。

やっているのは Terraform Cloud の変数を書き換えて run を起こすことだけで、**AWS の認証情報は
渡していない**。必要な設定は次のとおり。`PREVIEW_ENABLED` が `true` になるまで、プレビュー
関連のジョブは黙ってスキップされる。

| 種類     | 名前                                                            | 備考                                                     |
| -------- | --------------------------------------------------------------- | -------------------------------------------------------- |
| Secret   | `TFC_TOKEN`                                                     | `aws-preview` ワークスペースにスコープしたチームトークン |
| Variable | `PREVIEW_ENABLED`                                               | `true` で有効になる                                      |
| Variable | `TFC_ORGANIZATION` / `TFC_PREVIEW_WORKSPACE` / `PREVIEW_DOMAIN` | 省略時は infra 側の既定値                                |

イメージは PR でも GHCR に push する。タグは 2 つで、`pr-<番号>` は人が手元に持ってくる用、
`pr-<番号>-<sha>` がプレビューの指す先。可変タグだけだと push しても Terraform に差分が
出ず、プレビューが入れ替わらないため分けてある。fork や無関係な人の PR は
`author_association` のガードで publish 自体を弾いている (`pull_request_target` は使わない)。

`Dockerfile` に手を入れる必要はない。起動時マイグレーションがあるので、プレビューでも
コンテナが立ち上がるときに自分でスキーマを合わせる。

## 機能を足すとき

1. `src/feature/<domain>/domain/` に型とポートを定義する
2. `src/feature/<domain>/application/` にユースケースを書く (依存はポートのみ)
3. `src/feature/<domain>/infrastructure/` にポートの実装を書く (ここだけが `external` を知る)
4. `src/feature/<domain>/index.ts` で組み立てて公開する
5. `src/app/api/.../route.ts` から公開 API を呼ぶ
