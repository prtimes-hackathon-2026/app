import { existsSync } from 'node:fs'

import { defineConfig } from 'drizzle-kit'

// CLI から実行するときは .env を読む (アプリ実行時は Next.js / コンテナ側が渡す)
if (existsSync('.env')) process.loadEnvFile('.env')

/**
 * このアプリが所有する DB (AWS RDS) のマイグレーション設定。
 * スキーマの正はリポジトリ側にあるので、generate / migrate はこの設定で行う。
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/external/db/app/schema/index.ts',
  out: './drizzle/app/migrations',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.APP_DATABASE_URL ?? '',
    ssl: process.env.APP_DATABASE_SSL === 'disable' ? false : 'require',
  },
  strict: true,
  verbose: true,
})
