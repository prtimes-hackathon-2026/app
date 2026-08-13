import {
  schemaFilesFeature,
  type SchemaDatabase,
  type SchemaFile,
  type SchemaFileOrigin,
} from '@/feature/schema-files'
import { Card, CardBody, CardHeader, Icon } from '@/shared/ui'
import styles from './schema-files-card.module.css'

/**
 * Drizzle のスキーマ定義をその場で持ち出せるようにするカード。
 *
 * 並べるのは `src/external/db` 配下のスキーマ定義と、統計 DB を introspect した
 * `drizzle/stats` の生成物。実体は `/api/schema-files/<リポジトリ相対パス>` が返す。
 */

const groups: readonly {
  readonly database: SchemaDatabase
  readonly origin: SchemaFileOrigin
  readonly title: string
  readonly note: string
}[] = [
  {
    database: 'app',
    origin: 'definition',
    title: 'app',
    note: 'このアプリが所有する DB',
  },
  {
    database: 'stats',
    origin: 'definition',
    title: 'stats',
    note: '外部 DB を読むための定義',
  },
  {
    database: 'stats',
    origin: 'introspection',
    title: 'stats (pull)',
    note: 'introspect の生成物',
  },
]

function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
}

function FileRow({ file }: { file: SchemaFile }) {
  return (
    <li className={styles.file}>
      <span className={styles.fileName}>{file.name}</span>
      <span className={styles.fileSize}>{formatBytes(file.bytes)}</span>
      {/* API ルートへの遷移なので next/link ではなく素の <a> で降ろす */}
      <a
        className={styles.download}
        href={`/api/schema-files/${file.path}`}
        download
      >
        <Icon name="download" size={15} />
        ダウンロード
      </a>
    </li>
  )
}

export async function SchemaFilesCard() {
  const files = await schemaFilesFeature.listSchemaFiles()

  return (
    <Card tone="outlined">
      <CardHeader title="Drizzle のスキーマファイル" />
      <CardBody>
        <div className={styles.grid}>
          {groups.map((group) => {
            const groupFiles = files.filter(
              (file) =>
                file.database === group.database &&
                file.origin === group.origin,
            )

            return (
              <section
                key={`${group.database}-${group.origin}`}
                className={styles.group}
              >
                <div className={styles.groupHeader}>
                  <Icon name="document" size={15} />
                  <h3 className={styles.groupName}>{group.title}</h3>
                  <span className={styles.groupNote}>{group.note}</span>
                </div>

                {groupFiles.length === 0 ? (
                  <p className={styles.message}>ファイルがありません。</p>
                ) : (
                  <ul className={styles.files}>
                    {groupFiles.map((file) => (
                      <FileRow key={file.path} file={file} />
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
        <p className={styles.caption}>
          リポジトリに同梱している定義をそのまま返します。統計 DB
          は参照専用のため、その定義は pnpm db:stats:pull
          で実体から引き直したものです。
        </p>
      </CardBody>
    </Card>
  )
}
