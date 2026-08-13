import 'server-only'

import { drizzle } from 'drizzle-orm/postgres-js'

import { env } from '@/shared/env'

import { createSql } from '../connection'

import * as schema from './schema'

/**
 * このアプリが所有するデータベース (AWS RDS for PostgreSQL)。
 * スキーマの正はこのリポジトリ側にあり、マイグレーションもここから流す。
 */
type AppDatabase = ReturnType<typeof create>

function create() {
  const config = env()
  const sql = createSql('app', {
    url: config.APP_DATABASE_URL,
    ssl: config.APP_DATABASE_SSL,
    max: config.APP_DATABASE_POOL_MAX,
    applicationName: 'app',
  })
  return drizzle(sql, { schema, casing: 'snake_case' })
}

let cached: AppDatabase | undefined

/** 環境変数の検証を起動時ではなく初回アクセス時に行うため、関数越しに取得する */
export function appDb(): AppDatabase {
  cached ??= create()
  return cached
}
