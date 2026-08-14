import {
  diagnosticsFeature,
  type DatabaseTableCatalog,
} from '@/feature/diagnostics'

import { requireSignedIn } from './session'

/**
 * DB への疎通確認用のページ。
 * 接続先のテーブル一覧をそのまま出すだけで、業務上の意味は持たない。
 *
 * 業務上の意味は無くても接続先の構造は分かってしまうので、ログインは要求する。
 * 死活監視には認証の要らない `/api/health` を使う。
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
  await requireSignedIn()
  const catalogs = await diagnosticsFeature.listDatabaseTables()

  return (
    <main>
      <h1>データベースのテーブル一覧</h1>
      {catalogs.map((catalog) => (
        <Catalog key={catalog.database} catalog={catalog} />
      ))}
    </main>
  )
}
