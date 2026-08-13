import type { SchemaFile } from '../domain/schema-file'
import type { SchemaFileRepository } from '../domain/schema-file-repository'

/** ダウンロードできるスキーマファイルの一覧 */
export function listSchemaFiles(repository: SchemaFileRepository) {
  return (): Promise<readonly SchemaFile[]> => repository.list()
}
