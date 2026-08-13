import 'server-only'

import { drizzle } from 'drizzle-orm/postgres-js'

import { env } from '@/shared/env'

import { createSql } from '../connection'

import * as schema from './schema'

/**
 * 統計情報用の外部 PostgreSQL。
 * このアプリの管理外なので参照専用として扱い、書き込みや DDL は行わない。
 */
type StatsDatabase = ReturnType<typeof create>

function create() {
  const config = env()
  const sql = createSql('stats', {
    url: config.STATS_DATABASE_URL,
    ssl: config.STATS_DATABASE_SSL,
    max: config.STATS_DATABASE_POOL_MAX,
    applicationName: 'app-stats-reader',
  })
  return drizzle(sql, { schema, casing: 'snake_case' })
}

let cached: StatsDatabase | undefined

export function statsDb(): StatsDatabase {
  cached ??= create()
  return cached
}
