import { notFound } from 'next/navigation'
import { navigation } from '@/shared/app-config'
import { Card, CardBody, findNavTrail, PageHeader } from '@/shared/ui'

/**
 * ダッシュボード配下の中身がまだ無いページ。
 *
 * ナビゲーション定義に載っている URL であれば、見出しだけこの 1 ファイルで賄う。
 * 中身を作るときは同じ場所に page.tsx を足せば、そちらが優先される。
 */
export default async function PlaceholderPage({
  params,
}: {
  params: Promise<{ slug: string[] }>
}) {
  const { slug } = await params
  const pathname = `/${slug.join('/')}`
  const trail = findNavTrail(navigation, pathname)
  const current = trail.at(-1)

  // 定義に無い URL まで拾ってしまわないよう、ここで 404 に落とす
  if (!current) notFound()

  return (
    <>
      <PageHeader title={current.label} />
      <Card>
        <CardBody standalone>
          <p>ここに本文が入ります。</p>
        </CardBody>
      </Card>
    </>
  )
}
