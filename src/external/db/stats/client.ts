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
    // 業種単位の集計は業種の全リリースを走査するため重い。プロトタイプの調査でも
    // 150〜180 秒を要した。上限を切らないと、詰まった 1 本が参照専用プールの接続を
    // 握ったまま他のリクエストごと巻き込む。集計結果は app DB にキャッシュするので、
    // ここで打ち切られても次のリクエストが再試行できる。
    statementTimeoutMs: 180_000,
  })
  return drizzle(sql, { schema, casing: 'snake_case' })
}

let cached: StatsDatabase | undefined

export function statsDb(): StatsDatabase {
  cached ??= create()
  return cached
}
