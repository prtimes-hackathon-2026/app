import {
  diagnosticsFeature,
  type DatabaseTableCatalog,
} from '@/feature/diagnostics'
import { Card, CardBody, CardHeader, Icon } from '@/shared/ui'
import styles from './database-tables-card.module.css'

/**
 * DB 疎通確認用のテーブル一覧を、管理画面の体裁で出すカード。
 *
 * 中身は `/` (疎通確認ページ) と同じ `diagnosticsFeature.listDatabaseTables()`。
 * 片方の DB が落ちていてももう片方は表示したいので、
 * 失敗はカタログごとの状態として出し分ける。
 */

const databaseLabels: Record<
  DatabaseTableCatalog['database'],
  { name: string; note: string }
> = {
  app: { name: 'app', note: 'このアプリが所有する DB' },
  stats: { name: 'stats', note: '統計情報用の外部 DB・参照のみ' },
}

function Catalog({ catalog }: { catalog: DatabaseTableCatalog }) {
  const label = databaseLabels[catalog.database]

  return (
    <section className={styles.database}>
      <div className={styles.databaseHeader}>
        <Icon name="list" size={15} />
        <h3 className={styles.databaseName}>{label.name}</h3>
        <span className={styles.databaseNote}>{label.note}</span>
        <span
          className={
            catalog.ok
              ? `${styles.badge} ${styles.badgeOk}`
              : `${styles.badge} ${styles.badgeError}`
          }
        >
          {catalog.ok ? `${catalog.tables.length} テーブル` : '接続失敗'}
        </span>
      </div>

      {!catalog.ok ? (
        <p className={`${styles.message} ${styles.messageError}`}>
          接続に失敗しました: {catalog.error}
        </p>
      ) : catalog.tables.length === 0 ? (
        <p className={styles.message}>テーブルがありません。</p>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">スキーマ</th>
                <th scope="col">テーブル</th>
              </tr>
            </thead>
            <tbody>
              {catalog.tables.map((table) => (
                <tr key={`${table.schema}.${table.name}`}>
                  <td className={styles.schemaCell}>{table.schema}</td>
                  <td>{table.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export async function DatabaseTablesCard() {
  const catalogs = await diagnosticsFeature.listDatabaseTables()

  return (
    <Card tone="outlined">
      <CardHeader title="データベースのテーブル一覧" />
      <CardBody>
        <div className={styles.grid}>
          {catalogs.map((catalog) => (
            <Catalog key={catalog.database} catalog={catalog} />
          ))}
        </div>
        <p className={styles.caption}>
          接続確認用の表示です。業務上の意味は持ちません。
        </p>
      </CardBody>
    </Card>
  )
}

/** DB への問い合わせを待つ間の枠。Suspense の fallback に使う */
export function DatabaseTablesCardFallback() {
  return (
    <Card tone="outlined">
      <CardHeader title="データベースのテーブル一覧" />
      <CardBody>
        <p className={styles.message}>読み込み中…</p>
      </CardBody>
    </Card>
  )
}
