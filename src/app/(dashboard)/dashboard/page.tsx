import type { Metadata } from 'next'
import { type ReactNode } from 'react'
import {
  Callout,
  Card,
  CardBody,
  CardHeader,
  CollapsibleCard,
  PageHeader,
  Stack,
  StatGrid,
  StatTile,
} from '@/shared/ui'

export const metadata: Metadata = {
  title: 'ダッシュボード',
}

/**
 * ダッシュボード。
 * お知らせ枠はどれも同じ CollapsibleCard なので、増減は下の配列を編集するだけで済む。
 */
const notices: {
  id: string
  title: string
  defaultOpen?: boolean
  body?: ReactNode
}[] = [
  {
    id: 'draft',
    title: 'お知らせのタイトルが入ります',
    defaultOpen: false,
    body: <p>ここに本文が入ります。</p>,
  },
  {
    id: 'guideline',
    title: '掲載基準を更新しました',
    body: (
      <p>
        ここに本文が入ります。ここに本文が入ります。ここに本文が入ります。
        ここに本文が入ります。
        <a href="#dummy">詳細のご案内</a>
        をご確認いただけますと幸いです。
      </p>
    ),
  },
  {
    id: 'feature',
    title: '新機能のお知らせが入ります',
    body: (
      <>
        <p>
          ここに本文が入ります。ここに本文が入ります。ここに本文が入ります。
          ここに本文が入ります。ここに本文が入ります。ここに本文が入ります。
          ここに本文が入ります。
        </p>
        <p>
          ※ここに注記が入ります。ここに注記が入ります。ここに注記が入ります。
        </p>
        <p>
          <a href="#dummy">機能の詳細を見る</a>
        </p>
      </>
    ),
  },
  {
    id: 'company',
    title: '企業ページの情報を充実させましょう！',
    body: (
      <>
        <p>
          ここに本文が入ります。ここに本文が入ります（
          <a href="#dummy">設定する</a>）。
        </p>
        <p>
          詳しく知りたい方は<a href="#dummy">こちらの記事</a>をご参照ください。
        </p>
      </>
    ),
  },
  {
    id: 'founded',
    title: '会社設立日を設定しましょう！',
    defaultOpen: false,
    body: <p>ここに本文が入ります。</p>,
  },
]

const stats = [
  { label: 'プレスリリース配信数', value: '0', unit: '件', icon: 'send' },
  { label: 'ページビュー', value: '0', unit: 'PV', icon: 'eye' },
  { label: 'メディア掲載数', value: '0', unit: '件', icon: 'document' },
  { label: 'Webクリッピング', value: '0', unit: '件', icon: 'clip' },
] as const

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="ダッシュボード" />

      <Stack gap={4}>
        {/* 久しぶりに来た人を目的の再確認に戻す導線。
            本来は「最終アクセスから 1 年以上」などで出し分けたいが、
            最終アクセス日時を持つ仕組みがまだ無いので今は常に表示している。
            条件が用意できたらこの位置で出し分ける */}
        <Callout
          icon="compass"
          title="お久しぶりです"
          action={{ label: '目的を再確認する', href: '/purpose' }}
        >
          <p>PR TIMES を使う目的を、もう一度確認しませんか。</p>
        </Callout>

        {notices.map((notice) => (
          <CollapsibleCard
            key={notice.id}
            title={notice.title}
            defaultOpen={notice.defaultOpen}
          >
            {notice.body}
          </CollapsibleCard>
        ))}

        <Card>
          <CardHeader title="直近1か月間のデータ" />
          <CardBody>
            <StatGrid>
              {stats.map((stat) => (
                <StatTile
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                  unit={stat.unit}
                  icon={stat.icon}
                  note="集計期間: 直近1か月"
                />
              ))}
            </StatGrid>
          </CardBody>
        </Card>
      </Stack>
    </>
  )
}
