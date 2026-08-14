import type { Metadata } from 'next'

import {
  salesFlowCasesFeature,
  salesFlowReasonLabels,
  salesFlowReasons,
} from '@/feature/sales-flow-cases'
import { Card, CardBody, PageHeader, Stack } from '@/shared/ui'

import { SalesFlowCaseManager } from './case-manager'
import styles from './page.module.css'

export const metadata: Metadata = {
  title: '営業フロー事例',
}

export const dynamic = 'force-dynamic'

export default async function SalesFlowCasesPage() {
  const cases = await salesFlowCasesFeature.listSalesFlowCases()
  const reasonOptions = salesFlowReasons.map((value) => ({
    value,
    label: salesFlowReasonLabels[value],
  }))

  return (
    <>
      <PageHeader title="営業フロー事例" />
      <Stack gap={4}>
        <Card tone="outlined">
          <CardBody standalone className={styles.intro}>
            <div>
              <strong>目的設計の会話で使う営業フローを登録します。</strong>
              <p>
                停止理由に合う有効な事例を1件選び、AIの話し方と進め方へ反映します。
                統計DBの数値や会話の状態遷移は変更しません。
              </p>
            </div>
            <p className={styles.notice}>
              登録内容はアプリDBへ保存され、会話生成時にOpenAIへ送信される場合があります。個人情報や機密情報は入力しないでください。
            </p>
          </CardBody>
        </Card>
        <SalesFlowCaseManager cases={cases} reasonOptions={reasonOptions} />
      </Stack>
    </>
  )
}
