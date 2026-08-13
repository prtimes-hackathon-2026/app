import 'server-only'

import { listDatabaseTables } from './application/list-database-tables'
import { drizzleTableCatalogRepositories } from './infrastructure/table-catalog-repository.drizzle'

export type {
  DatabaseName,
  DatabaseTable,
  DatabaseTableCatalog,
} from './domain/database-table'
export { databaseNames } from './domain/database-table'

/**
 * この feature の合成ルート。app 層からはこのオブジェクト経由でのみ呼び出す。
 * 疎通確認用であり、業務上の意味は持たない。
 */
const repositories = drizzleTableCatalogRepositories()

export const diagnosticsFeature = {
  listDatabaseTables: listDatabaseTables(repositories),
} as const
