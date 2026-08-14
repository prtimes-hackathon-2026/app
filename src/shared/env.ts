import 'server-only'

import { z } from 'zod'

/**
 * サーバー側の環境変数。値の検証はここ 1 か所だけで行い、
 * 他のレイヤーは「検証済みの型付き設定」だけを受け取る。
 */
const sslModeSchema = z.enum(['disable', 'require', 'verify-full'])
const migrateOnStartupSchema = z.stringbool()

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  // このアプリ自身のデータベース (AWS RDS for PostgreSQL)
  APP_DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  APP_DATABASE_SSL: sslModeSchema.default('require'),
  APP_DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  APP_DATABASE_MIGRATE_ON_STARTUP: migrateOnStartupSchema.optional(),

  // PR TIMES のデータベース (このアプリの管理外・参照のみ)
  STATS_DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  STATS_DATABASE_SSL: sslModeSchema.default('require'),
  STATS_DATABASE_POOL_MAX: z.coerce.number().int().positive().default(5),

  // PR羅針盤 AI コーチング機能。
  // キーが無くてもテンプレの下書きをそのまま出せば会話は成立するので optional に
  // している。ここで必須にすると、キーを持たない環境でアプリ全体が動かなくなる。
  OPENAI_API_KEY: z.string().min(1).optional(),
})

export type Env = z.infer<typeof envSchema>
export type SslMode = z.infer<typeof sslModeSchema>

let cached: Env | undefined

/**
 * 遅延評価にしているのは、環境変数が無い環境 (next build / CI) でも
 * ビルドが通るようにするため。実際に DB へ触れる瞬間に初めて検証される。
 */
export function env(): Env {
  if (cached) return cached

  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    throw new Error(`環境変数が不正です:\n${z.prettifyError(parsed.error)}`, {
      cause: parsed.error,
    })
  }

  cached = parsed.data
  return cached
}

/**
 * 起動時にマイグレーションを流すか。既定は production のみ。
 *
 * ここだけ `env()` を通さず生の環境変数を見るのは、DB の設定が無い環境
 * (`.env` を置かずに `pnpm dev` を叩く、CI の `next build` など) でも
 * サーバーが起動できるようにするため。production では接続情報が必ず揃って
 * いる前提なので、揃っていなければ起動時に落ちてよい。
 */
export function shouldMigrateOnStartup(): boolean {
  const raw = process.env.APP_DATABASE_MIGRATE_ON_STARTUP
  if (raw === undefined) return process.env.NODE_ENV === 'production'

  const parsed = migrateOnStartupSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(
      `APP_DATABASE_MIGRATE_ON_STARTUP が不正です (true / false):\n${z.prettifyError(parsed.error)}`,
      { cause: parsed.error },
    )
  }

  return parsed.data
}
