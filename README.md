# app

Vite (React) + Hono の TypeScript モノレポ。**Bootstrap 用のテンプレートで、アプリの中身はまだ入っていない。**

## 構成

```
.
├── apps/
│   ├── api/            Hono バックエンド (@hono/node-server)
│   └── web/            Vite + React フロントエンド
├── packages/
│   └── shared/         両側で共有する zod スキーマ / 型
├── pnpm-workspace.yaml ワークスペース定義 + catalog
├── tsconfig.base.json  全パッケージ共通の compilerOptions
└── eslint.config.js    ルートに 1 つの flat config
```

## セットアップ

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # 任意
cp apps/web/.env.example apps/web/.env   # 任意
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:8787

dev 中は Vite の proxy が `/api/*` を Hono に転送するので、ブラウザから見ると同一オリジンになる。CORS も cookie も特別な設定なしで動く。

## コマンド

| コマンド         | 内容                                                          |
| ---------------- | ------------------------------------------------------------- |
| `pnpm dev`       | web と api を並列起動                                         |
| `pnpm build`     | 両アプリをビルド（web → 静的ファイル、api → `dist/index.js`） |
| `pnpm start`     | ビルド済み API を起動                                         |
| `pnpm typecheck` | 全パッケージで `tsc --noEmit`                                 |
| `pnpm lint`      | ESLint                                                        |
| `pnpm format`    | Prettier                                                      |
| `pnpm check`     | typecheck + lint + format:check                               |

個別に動かすときは `pnpm --filter @repo/api dev` のようにする。

## 型共有の仕組み

3 層に分かれている。

### 1. `@repo/shared` — 両側が合意した形

`packages/shared/src/contracts.ts` に zod スキーマとドメイン型を置く。API はこのスキーマで実行時に検証し、フロントは同じスキーマから導出した型を使う。

```ts
export const greetRequestSchema = z.object({ name: z.string().min(1).max(50) })
export type GreetRequest = z.infer<typeof greetRequestSchema>
```

このパッケージは **ビルド成果物ではなく TS ソースをそのまま公開している**（`package.json` の `exports` が `./src/index.ts` を指す）。Vite も tsx も TS を直接読めるので、ビルド順を気にする必要がなく、編集は即座に両側へ反映される。

### 2. Hono RPC — ルート定義そのものを型として渡す

`apps/api/src/app.ts` はルートをメソッドチェーンで組み立て、その型を `AppType` として export する。

```ts
export const app = new Hono()
  .get('/api/health', ...)
  .post('/api/greet', zValidator('json', greetRequestSchema), ...)

export type AppType = typeof app
```

フロントは `apps/web/src/lib/api.ts` でそれを受け取る。

```ts
import type { AppType } from '@repo/api'
export const client = hc<AppType>(import.meta.env.VITE_API_BASE_URL ?? '/')
```

`import type` なので実行時の依存はゼロ（フロントのバンドルに API のコードは入らない）。パス・メソッド・リクエストボディ・レスポンスの型がすべて補完され、バックエンドを変更するとフロント側がコンパイルエラーになる。

> ⚠️ ルートを `app.get(...)` と個別の文で書くと `AppType` に型が積み上がらない。**必ずチェーンで繋ぐこと。**

### 3. catalog — ライブラリのバージョン統一

`zod` や `hono` が web と api で別バージョンになると、同じに見える型が別物として扱われて謎のエラーになる。`pnpm-workspace.yaml` の `catalog:` で一元管理し、各 `package.json` では `"zod": "catalog:"` と書く。

## 追加するとき

- **API のルート**: `apps/api/src/app.ts` のチェーンに足す。数が増えたら `src/routes/*.ts` にサブアプリを切り出し、`.route('/api/xxx', xxxRoutes)` で繋ぐ（チェーンのままなら型は維持される）。
- **共有の型・スキーマ**: `packages/shared/src/` にファイルを足して `index.ts` から re-export する。
- **新しいパッケージ**: `packages/<name>/` を作れば `pnpm-workspace.yaml` の `packages/*` に自動で拾われる。`tsconfig.json` は `tsconfig.base.json` を extends する。

## メモ

- TypeScript は 6.0 系に固定している。7.0（ネイティブ版コンパイラ）は公開済みだが、`typescript-eslint` がまだ `<6.1.0` しかサポートしていないため。lint を諦めるか typescript-eslint が対応したら `pnpm-workspace.yaml` の catalog を上げる。
- API の本番ビルドは tsup で、`@repo/*` はバンドルに取り込み（`noExternal`）、実依存は external にしている。`apps/api/dist/` だけを持ち出すことはできず、`node_modules` が必要。
- テストランナーは未導入。入れるなら Vitest が両側で使い回せる。
