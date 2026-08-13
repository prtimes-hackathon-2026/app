import { existsSync } from 'node:fs'

import { defineConfig } from 'drizzle-kit'

if (existsSync('.env')) process.loadEnvFile('.env')

/**
 * 統計 DB (外部 PostgreSQL) の設定。
 *
 * この DB はこのアプリの管理外なので introspect (`pnpm db:stats:pull`) 専用に使う。
 * generate / migrate / push は絶対に実行しないこと。
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/external/db/stats/schema/index.ts',
  out: './drizzle/stats',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.STATS_DATABASE_URL ?? '',
    ssl: process.env.STATS_DATABASE_SSL === 'disable' ? false : 'require',
  },
  strict: true,
  verbose: true,
})
