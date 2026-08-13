import type { Metadata } from 'next'
import { Card, CardBody, PageHeader } from '@/shared/ui'

export const metadata: Metadata = {
  title: '目的の再確認',
}

/**
 * ダッシュボード先頭の導線 (Callout) の行き先。
 * ここから先が自分たちのアプリになる想定で、今は受け皿だけ置いている。
 */
export default function PurposePage() {
  return (
    <>
      <PageHeader
        title="PR TIMES を使う目的の再確認"
        description="ここに本文が入ります。"
      />
      <Card>
        <CardBody standalone>
          <p>ここに本文が入ります。</p>
        </CardBody>
      </Card>
    </>
  )
}
