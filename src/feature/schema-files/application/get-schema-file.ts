import type { SchemaFileContent } from '../domain/schema-file'
import type { SchemaFileRepository } from '../domain/schema-file-repository'

/**
 * 1 ファイル分の中身を取り出す。
 *
 * 受け取ったパスは必ず一覧と突き合わせ、載っていないものは読まない。
 * こうしておけば URL に何を書かれても、公開する気のないファイルには届かない。
 */
export function getSchemaFile(repository: SchemaFileRepository) {
  return async (path: string): Promise<SchemaFileContent | undefined> => {
    const files = await repository.list()
    const file = files.find((candidate) => candidate.path === path)
    if (!file) return undefined

    return { file, text: await repository.read(file) }
  }
}
