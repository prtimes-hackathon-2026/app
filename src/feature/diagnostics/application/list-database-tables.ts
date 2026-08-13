import type {
  DatabaseName,
  DatabaseTableCatalog,
} from '../domain/database-table'
import { databaseNames } from '../domain/database-table'
import type { TableCatalogRepository } from '../domain/table-catalog-repository'

export type ListDatabaseTables = () => Promise<readonly DatabaseTableCatalog[]>

/** 例外を画面に出せる文字列へ落とす。スタックトレースは残さない */
function toMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

export function listDatabaseTables(
  repositories: Readonly<Record<DatabaseName, TableCatalogRepository>>,
): ListDatabaseTables {
  return async () =>
    // 片方の DB が落ちていてももう片方は表示したいので、それぞれ独立に扱う
    Promise.all(
      databaseNames.map(async (database) => {
        try {
          const tables = await repositories[database].listTables()
          return { database, ok: true, tables } as const
        } catch (cause) {
          return { database, ok: false, error: toMessage(cause) } as const
        }
      }),
    )
}
