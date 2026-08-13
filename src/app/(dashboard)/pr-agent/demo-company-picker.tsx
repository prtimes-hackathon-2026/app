'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import type { StoppedCompany } from '@/feature/pr-metrics'
import { Button, Card, CardBody, CardHeader, Stack } from '@/shared/ui'

import { Alert } from './alert'
import { blank, formatDate, formatNumber } from './format'
import styles from './pr-agent.module.css'

/**
 * デモ用の企業選択。
 *
 * 認証がまだ無いため、対象の企業をこの画面で選ばせている (設計 §11(a) の暫定措置)。
 * feature 側は常に「確定した企業 ID」を受け取る形なので、認証が入ったら
 * この画面を消して ID の出どころを差し替えるだけで済む。
 */
export function DemoCompanyPicker({
  companies,
}: {
  companies: readonly StoppedCompany[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function start(companyId: number) {
    // 二重送信の防止。会話が 2 つできてしまうのを避ける
    if (isPending) return
    setError(null)

    startTransition(async () => {
      let response: Response
      try {
        response = await fetch('/api/pr-agent/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId }),
        })
      } catch {
        setError('通信に失敗しました。もう一度お試しください。')
        return
      }

      if (!response.ok) {
        setError('会話を開始できませんでした。')
        return
      }

      const body: unknown = await response.json()
      const conversationId = conversationIdOf(body)
      if (conversationId === null) {
        setError('会話 ID を受け取れませんでした。')
        return
      }

      // 会話 ID を URL に持たせる。以降の描画はサーバが会話を読み直して行う
      router.push(
        `/pr-agent?conversation=${encodeURIComponent(conversationId)}`,
      )
    })
  }

  if (companies.length === 0) {
    return (
      <Card tone="outlined">
        <CardBody standalone>
          <p className={styles.note}>対象になる企業が見つかりませんでした。</p>
        </CardBody>
      </Card>
    )
  }

  return (
    <Stack gap={4}>
      {error === null ? null : <Alert message={error} />}

      <Card tone="outlined">
        <CardHeader title="配信が止まっている企業" />
        <CardBody>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption>1 社選ぶと、その企業のデータで対話を始めます。</caption>
              <thead>
                <tr>
                  <th scope="col">企業</th>
                  <th scope="col">業種</th>
                  <th scope="col" className={styles.num}>
                    配信本数
                  </th>
                  <th scope="col" className={styles.num}>
                    最後の配信
                  </th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={company.companyId}>
                    <th scope="row">
                      {company.companyName ?? `ID ${company.companyId}`}
                    </th>
                    <td>{company.industryName ?? blank}</td>
                    <td className={styles.num}>
                      {formatNumber(company.releases)}本
                    </td>
                    <td className={styles.num}>
                      {formatDate(company.lastReleasedAt)}
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="accent"
                        iconEnd="chevronRight"
                        disabled={isPending}
                        onClick={() => start(company.companyId)}
                      >
                        この企業で始める
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </Stack>
  )
}

function conversationIdOf(body: unknown): string | null {
  if (
    typeof body === 'object' &&
    body !== null &&
    'conversationId' in body &&
    typeof body.conversationId === 'string'
  ) {
    return body.conversationId
  }
  return null
}
