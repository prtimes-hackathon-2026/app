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

  // 目的設計 AI コーチング機能。
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

/**
 * 簡易ログインの設定。
 *
 * 共有の合言葉を 1 つ知っていれば入れる、という割り切った仕組みなので、
 * 利用者ごとの資格情報は持たない (README「簡易ログイン」)。
 */
const authSchema = z.object({
  // 合言葉。既定値はデモ用で、公開する環境では必ず差し替える
  AUTH_PASSWORD: z.string().min(1).default('prtimes'),
  // 管理者用の合言葉。企業用とは分け、管理機能へ直接入る
  AUTH_ADMIN_PASSWORD: z.string().min(1).default('admin'),
  // セッション Cookie の署名鍵。未設定でも動くが、production では設定する (下の authConfig)
  AUTH_SESSION_SECRET: z.string().min(32).optional(),
})

export type AuthConfig = {
  readonly password: string
  readonly adminPassword: string
  readonly sessionSecret: string
}

/**
 * 開発用の署名鍵。
 *
 * これで署名した Cookie は「開発機で作った」以上の意味を持たない。
 * 固定値にしているのは、`pnpm dev` が再起動するたびにログインし直さずに済むようにするため。
 */
const developmentSessionSecret =
  'development-only-session-secret-do-not-use-in-production'

/**
 * 鍵が未設定のまま production で動かしてしまったときの落としどころ。
 *
 * 起動時に落とす手もあるが、DB の接続情報と違って安全な代わりを用意できる。
 * 乱数で作れば署名の強度は落ちない (リポジトリを読める人にも偽造できない)。
 * 代わりにプロセスをまたいでセッションを持ち回れないので、再起動でログアウトし、
 * 複数タスク構成では入り直しを求められる。それが分かるように警告を出す。
 *
 * 鍵は `globalThis` に置く。Next.js はルートごとに別のモジュール実体を作るため、
 * モジュールスコープに持つとルートハンドラと画面で違う鍵になり、
 * 自分で署名した Cookie を自分で検証できなくなる。
 */
const generatedSecretProperty = '__appGeneratedSessionSecret'

function generatedSessionSecret(): string {
  const holder = globalThis as typeof globalThis & {
    [generatedSecretProperty]?: string
  }
  if (holder[generatedSecretProperty] === undefined) {
    holder[generatedSecretProperty] = crypto.randomUUID() + crypto.randomUUID()
    console.warn(
      'AUTH_SESSION_SECRET が未設定です。起動ごとの乱数で代用します' +
        '(再起動やタスクの入れ替わりでログアウトします)。' +
        'openssl rand -base64 32 で作った値を設定してください',
    )
  }
  return holder[generatedSecretProperty]
}

let cachedAuth: AuthConfig | undefined

/**
 * ここも `env()` を通さず生の環境変数を見る。理由は shouldMigrateOnStartup() と同じで、
 * DB の接続情報が無い環境 (模擬データで動かすデモ、CI の `next build`) でも
 * ログイン画面までは出せるようにしておきたいため。
 */
export function authConfig(): AuthConfig {
  if (cachedAuth) return cachedAuth

  const parsed = authSchema.safeParse(process.env)
  if (!parsed.success) {
    throw new Error(
      `ログインの環境変数が不正です:\n${z.prettifyError(parsed.error)}`,
      { cause: parsed.error },
    )
  }

  const secret = parsed.data.AUTH_SESSION_SECRET
  const fallback =
    process.env.NODE_ENV === 'production'
      ? generatedSessionSecret()
      : developmentSessionSecret

  cachedAuth = {
    password: parsed.data.AUTH_PASSWORD,
    adminPassword: parsed.data.AUTH_ADMIN_PASSWORD,
    sessionSecret: secret ?? fallback,
  }
  return cachedAuth
}
