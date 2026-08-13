# app

Next.js (App Router) の API サーバー。画面は持たず、ルーティング・ドメイン実装・外部接続を
レイヤーで分離した骨組みだけを用意している。

## ディレクトリ構成

```
src/
├── app/                     ルーティングと HTTP 境界だけ。ビジネスロジックを置かない
│   └── api/health/route.ts
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
    └── env.ts               環境変数の検証 (zod)
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
| `pnpm db:app:studio`                     | Drizzle Studio                                      |
| `pnpm db:stats:pull`                     | 統計 DB を introspect してスキーマを引き直す        |

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

## 機能を足すとき

1. `src/feature/<domain>/domain/` に型とポートを定義する
2. `src/feature/<domain>/application/` にユースケースを書く (依存はポートのみ)
3. `src/feature/<domain>/infrastructure/` にポートの実装を書く (ここだけが `external` を知る)
4. `src/feature/<domain>/index.ts` で組み立てて公開する
5. `src/app/api/.../route.ts` から公開 API を呼ぶ
