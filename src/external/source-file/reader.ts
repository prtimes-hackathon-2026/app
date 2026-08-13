import 'server-only'

import { readdir, readFile, stat } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'

/**
 * リポジトリに同梱したテキストファイルを読み出す。
 *
 * DB と同じく「アプリの外にあるもの」なので external に置く。
 * 本番は Next.js の standalone 出力で動き、`src/` などはそのままでは同梱されない。
 * ここで読むディレクトリは `next.config.ts` の `outputFileTracingIncludes` に
 * 必ず登録すること。
 */

export type SourceFile = {
  /** プロジェクトルートからの相対パス (POSIX 区切り) */
  readonly path: string
  readonly bytes: number
}

/**
 * standalone 出力でも `server.js` を置いた場所が基準になるので cwd でよい
 * (Dockerfile の WORKDIR と、traced file のコピー先が一致している)。
 */
function projectRoot(): string {
  return process.cwd()
}

/**
 * プロジェクトの外を指す相対パスを弾く。
 * 呼び出し側が URL 由来の値を渡してきても、ここから外には出られないようにする。
 *
 * `turbopackIgnore` を付けているのは、行き先が動的だとビルドの静的解析が
 * 「プロジェクト全体が必要」と判断して standalone に全ファイルを載せてしまうため。
 * 実際に要るものは `next.config.ts` の `outputFileTracingIncludes` で明示している。
 */
function toAbsolute(path: string): string {
  const root = projectRoot()
  const absolute = resolve(/*turbopackIgnore: true*/ root, path)
  const inside = relative(root, absolute)
  if (inside === '' || inside.startsWith('..') || isAbsolute(inside)) {
    throw new Error(`プロジェクト外のパスは読めません: ${path}`)
  }
  return absolute
}

function isNotFound(error: unknown): boolean {
  return (
    error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT'
  )
}

/**
 * ディレクトリ直下のファイルを名前順で返す。
 * ディレクトリが無い場合は空配列 (pull していない・同梱漏れ)。
 */
export async function listSourceFiles(
  directory: string,
  extension: string,
): Promise<readonly SourceFile[]> {
  const absolute = toAbsolute(directory)

  let entries
  try {
    entries = await readdir(absolute, { withFileTypes: true })
  } catch (error) {
    if (isNotFound(error)) return []
    throw error
  }

  const names = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .map((entry) => entry.name)
    .sort()

  return Promise.all(
    names.map(async (name) => ({
      path: `${directory}/${name}`,
      bytes: (await stat(join(absolute, name))).size,
    })),
  )
}

export function readSourceFile(path: string): Promise<string> {
  return readFile(toAbsolute(path), 'utf8')
}
