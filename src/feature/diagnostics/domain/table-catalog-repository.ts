import type { DatabaseTable } from './database-table'

/**
 * データベースのテーブル一覧を引くポート。実装は infrastructure 側に置く。
 * ここに SQL や information_schema といった語彙を持ち込まないこと。
 */
export interface TableCatalogRepository {
  listTables(): Promise<readonly DatabaseTable[]>
}
