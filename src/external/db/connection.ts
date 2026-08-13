import 'server-only'

import postgres from 'postgres'

import type { SslMode } from '@/shared/env'

export type ConnectionConfig = {
  readonly url: string
  readonly ssl: SslMode
  readonly max: number
  /** 接続先の pg_stat_activity で接続元を判別できるようにする */
  readonly applicationName: string
}

/**
 * dev サーバーはモジュールを HMR で再評価するため、素直に生成すると
 * 接続が増え続ける。プロセス単位のレジストリに載せて 1 接続プールを共有する。
 */
type GlobalWithRegistry = typeof globalThis & {
  __sqlRegistry?: Map<string, postgres.Sql>
}

function registry(): Map<string, postgres.Sql> {
  const g = globalThis as GlobalWithRegistry
  g.__sqlRegistry ??= new Map<string, postgres.Sql>()
  return g.__sqlRegistry
}

export function toSslOption(mode: SslMode): postgres.Options<never>['ssl'] {
  return mode === 'disable' ? false : mode
}

export function createSql(key: string, config: ConnectionConfig): postgres.Sql {
  const existing = registry().get(key)
  if (existing) return existing

  const sql = postgres(config.url, {
    ssl: toSslOption(config.ssl),
    max: config.max,
    connection: { application_name: config.applicationName },
    // 接続確立とアイドル接続の上限。RDS 側の接続数を食い潰さないようにする
    connect_timeout: 10,
    idle_timeout: 30,
  })

  registry().set(key, sql)
  return sql
}
