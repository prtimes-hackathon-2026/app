import 'server-only'

import { sql } from 'drizzle-orm'

import { appDb } from '@/external/db/app'
import { statsDb } from '@/external/db/stats'

import type { DatabaseName, DatabaseTable } from '../domain/database-table'
import type { TableCatalogRepository } from '../domain/table-catalog-repository'

/** information_schema から返る行。列名は SQL の見た目そのまま */
type TableRow = {
  readonly table_schema: string
  readonly table_name: string
}

/**
 * ユーザー定義のテーブルだけを拾う。
 * ビューや外部テーブルは対象外にしたいので table_type で絞る。
 */
const listTablesQuery = sql`
  select table_schema, table_name
  from information_schema.tables
  where table_type = 'BASE TABLE'
    and table_schema not in ('pg_catalog', 'information_schema')
  order by table_schema, table_name
`

function toTable(row: TableRow): DatabaseTable {
  return { schema: row.table_schema, name: row.table_name }
}

function repository(
  runQuery: () => Promise<readonly TableRow[]>,
): TableCatalogRepository {
  return {
    async listTables() {
      const rows = await runQuery()
      return rows.map(toTable)
    },
  }
}

/**
 * このアプリが接続する DB ごとのアダプタ。
 * appDb() / statsDb() の呼び出しを遅延させ、環境変数の検証を実際の問い合わせ時まで遅らせる。
 */
export function drizzleTableCatalogRepositories(): Readonly<
  Record<DatabaseName, TableCatalogRepository>
> {
  return {
    app: repository(() => appDb().execute<TableRow>(listTablesQuery)),
    stats: repository(() => statsDb().execute<TableRow>(listTablesQuery)),
  }
}
