import 'server-only'

import { z } from 'zod'

/**
 * サーバー側の環境変数。値の検証はここ 1 か所だけで行い、
 * 他のレイヤーは「検証済みの型付き設定」だけを受け取る。
 */
const sslModeSchema = z.enum(['disable', 'require', 'verify-full'])

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  // このアプリ自身のデータベース (AWS RDS for PostgreSQL)
  APP_DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  APP_DATABASE_SSL: sslModeSchema.default('require'),
  APP_DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),

  // 統計情報用の外部 PostgreSQL (このアプリの管理外・参照のみ)
  STATS_DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  STATS_DATABASE_SSL: sslModeSchema.default('require'),
  STATS_DATABASE_POOL_MAX: z.coerce.number().int().positive().default(5),

  // PR羅針盤 AI コーチング機能
  OPENAI_API_KEY: z.string().optional(),
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
