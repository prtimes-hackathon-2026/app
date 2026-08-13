/** スキーマ定義が対応するデータベース */
export type SchemaDatabase = 'app' | 'stats'

/**
 * そのファイルが何なのか。
 *
 * - `definition`    : リポジトリが持つ Drizzle のスキーマ定義 (アプリが実際に読むもの)
 * - `introspection` : `drizzle-kit pull` が DB の実体から引いた生成物
 */
export type SchemaFileOrigin = 'definition' | 'introspection'

export type SchemaFile = {
  /** リポジトリルートからの相対パス。ダウンロード URL の識別子を兼ねる */
  readonly path: string
  readonly name: string
  readonly database: SchemaDatabase
  readonly origin: SchemaFileOrigin
  readonly bytes: number
}

export type SchemaFileContent = {
  readonly file: SchemaFile
  readonly text: string
}

/**
 * ダウンロードしたときのファイル名。
 * `index.ts` や `schema.ts` は複数の場所にあるので、どの DB の何かが分かるよう平坦化する。
 */
export function downloadNameOf(file: SchemaFile): string {
  const prefix =
    file.origin === 'introspection' ? `${file.database}-pull` : file.database
  return `${prefix}-${file.name}`
}
