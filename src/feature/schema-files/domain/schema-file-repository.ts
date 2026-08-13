import type { SchemaFile } from './schema-file'

/**
 * リポジトリに同梱されたスキーマ定義の取り出し口。
 *
 * `read` が受け取るのは `list` が返した値そのものなので、
 * 外から来た文字列がファイルパスとして解決されることはない。
 */
export interface SchemaFileRepository {
  list(): Promise<readonly SchemaFile[]>
  read(file: SchemaFile): Promise<string>
}
