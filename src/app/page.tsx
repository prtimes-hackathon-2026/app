import {
  diagnosticsFeature,
  type DatabaseTableCatalog,
} from '@/feature/diagnostics'
import styles from './page.module.css'

/**
 * DB への疎通確認用のページ。
 * 接続先のテーブル一覧をそのまま出すだけで、業務上の意味は持たない。
 */
export const dynamic = 'force-dynamic'

const databaseLabels: Record<DatabaseTableCatalog['database'], string> = {
  app: 'app (このアプリが所有する DB)',
  stats: 'stats (統計情報用の外部 DB・参照のみ)',
}

function Catalog({ catalog }: { catalog: DatabaseTableCatalog }) {
  return (
    <section>
      <h2>{databaseLabels[catalog.database]}</h2>

      {!catalog.ok ? (
        <p>接続に失敗しました: {catalog.error}</p>
      ) : catalog.tables.length === 0 ? (
        <p>テーブルがありません。</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th align="left">スキーマ</th>
              <th align="left">テーブル</th>
            </tr>
          </thead>
          <tbody>
            {catalog.tables.map((table) => (
              <tr key={`${table.schema}.${table.name}`}>
                <td>{table.schema}</td>
                <td>{table.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

export default async function Page() {
  const catalogs = await diagnosticsFeature.listDatabaseTables()

  return (
    <main className={styles.main}>
      <h1>データベースのテーブル一覧</h1>
      {catalogs.map((catalog) => (
        <Catalog key={catalog.database} catalog={catalog} />
      ))}
    </main>
  )
}
