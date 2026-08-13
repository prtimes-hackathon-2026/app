import { downloadNameOf, schemaFilesFeature } from '@/feature/schema-files'

/**
 * Drizzle のスキーマファイルをダウンロードさせる。
 *
 * URL のパスをそのままファイルに解決せず、feature 側の一覧に載っているものだけを返す。
 * 中身はリポジトリに同梱された定義そのもので、DB には触らない。
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<'/api/schema-files/[...path]'>,
) {
  const { path } = await ctx.params
  const found = await schemaFilesFeature.getSchemaFile(path.join('/'))

  if (!found) {
    return new Response('スキーマファイルが見つかりません。\n', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  return new Response(found.text, {
    headers: {
      // .ts をブラウザに解釈させたくないので、表示ではなく保存させる
      'content-type': 'text/plain; charset=utf-8',
      'content-disposition': `attachment; filename="${downloadNameOf(found.file)}"`,
      'cache-control': 'no-store',
    },
  })
}
