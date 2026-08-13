import 'server-only'

import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

import { env, shouldMigrateOnStartup } from '@/shared/env'

import { toSslOption } from '../connection'

/**
 * `drizzle-kit generate` の出力先。standalone ビルドには含まれないため、
 * Dockerfile の runner ステージで別途コピーしている。
 */
const migrationsFolder = './drizzle/app/migrations'

/**
 * 同時に起動したタスクが同じマイグレーションを二重に流さないためのロック。
 * 値そのものに意味はなく、この用途で一意であればよい。
 */
const advisoryLockKey = 8_240_113

/**
 * アプリ用 DB にマイグレーションを適用する。
 *
 * アプリ本体の接続プールとは別に、専用の接続を 1 本だけ張る。セッション単位の
 * アドバイザリロックは取得した接続と紐づくため、プールを共有すると別の接続で
 * 解放しようとして噛み合わない。
 */
export async function migrateAppDb(): Promise<void> {
  const config = env()

  const sql = postgres(config.APP_DATABASE_URL, {
    ssl: toSslOption(config.APP_DATABASE_SSL),
    max: 1,
    connection: { application_name: 'app-migrate' },
    connect_timeout: 10,
  })

  try {
    // 先に取った 1 つだけが流す。他は解放されるまでここで待ち、
    // 待っている間に完了した分は適用済みとして飛ばされる
    await sql`SELECT pg_advisory_lock(${advisoryLockKey})`
    await migrate(drizzle(sql), { migrationsFolder })
  } finally {
    // 接続を閉じればロックも解放される
    await sql.end()
  }
}

/**
 * 起動時マイグレーション。既定では本番だけで走る (`shouldMigrateOnStartup`)。
 *
 * 失敗したら例外をそのまま投げてサーバーを起動させない。ECS では
 * deployment circuit breaker が働いて旧タスクへ切り戻る。
 */
export async function migrateAppDbOnStartup(): Promise<void> {
  if (!shouldMigrateOnStartup()) return

  const startedAt = performance.now()
  await migrateAppDb()
  const elapsed = Math.round(performance.now() - startedAt)

  console.info(`[migrate] アプリ用 DB のマイグレーションが完了 (${elapsed}ms)`)
}
