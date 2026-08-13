import 'server-only'

import { listSourceFiles, readSourceFile } from '@/external/source-file'

import type {
  SchemaDatabase,
  SchemaFile,
  SchemaFileOrigin,
} from '../domain/schema-file'
import type { SchemaFileRepository } from '../domain/schema-file-repository'

/**
 * どのディレクトリに何が置いてあるかを知るのはこのアダプタだけ。
 *
 * ここを増やしたら `next.config.ts` の `outputFileTracingIncludes` も揃えること。
 * standalone 出力には同梱されず、本番だけ空になる。
 */
const sources: readonly {
  readonly directory: string
  readonly database: SchemaDatabase
  readonly origin: SchemaFileOrigin
}[] = [
  {
    directory: 'src/external/db/app/schema',
    database: 'app',
    origin: 'definition',
  },
  {
    directory: 'src/external/db/stats/schema',
    database: 'stats',
    origin: 'definition',
  },
  { directory: 'drizzle/stats', database: 'stats', origin: 'introspection' },
]

function basenameOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

export function fsSchemaFileRepository(): SchemaFileRepository {
  return {
    async list() {
      const groups = await Promise.all(
        sources.map(async (source) => {
          const files = await listSourceFiles(source.directory, '.ts')
          return files.map((file): SchemaFile => ({
            path: file.path,
            name: basenameOf(file.path),
            database: source.database,
            origin: source.origin,
            bytes: file.bytes,
          }))
        }),
      )
      return groups.flat()
    },

    read(file) {
      return readSourceFile(file.path)
    },
  }
}
