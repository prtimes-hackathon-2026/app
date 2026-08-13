import 'server-only'

import { getSchemaFile } from './application/get-schema-file'
import { listSchemaFiles } from './application/list-schema-files'
import { fsSchemaFileRepository } from './infrastructure/schema-file-repository.fs'

export { downloadNameOf } from './domain/schema-file'
export type {
  SchemaDatabase,
  SchemaFile,
  SchemaFileContent,
  SchemaFileOrigin,
} from './domain/schema-file'

/**
 * この feature の合成ルート。app 層からはこのオブジェクト経由でのみ呼び出す。
 * 扱うのはリポジトリに同梱された Drizzle のスキーマ定義だけで、DB には触らない。
 */
const repository = fsSchemaFileRepository()

export const schemaFilesFeature = {
  listSchemaFiles: listSchemaFiles(repository),
  getSchemaFile: getSchemaFile(repository),
} as const
