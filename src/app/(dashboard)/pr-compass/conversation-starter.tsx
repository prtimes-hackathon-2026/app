'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button, Card, CardBody, CardHeader, Stack } from '@/shared/ui'

import { Alert } from './alert'
import styles from './blocks.module.css'

/**
 * 対話の入り口。
 *
 * 対象の企業はログインしたときに決まっているので、ここでは選ばせない
 * (以前はこの画面で企業を選ばせていた。設計 §11(a) の暫定措置)。
 * 会話を作る POST も企業 ID を送らない。誰の会話かはサーバがセッションから決める。
 */
export function ConversationStarter({ companyName }: { companyName: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function start() {
    // 二重送信の防止。会話が 2 つできてしまうのを避ける
    if (isPending) return
    setError(null)

    startTransition(async () => {
      let response: Response
      try {
        response = await fetch('/api/pr-agent/conversations', {
          method: 'POST',
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
        `/pr-compass?conversation=${encodeURIComponent(conversationId)}`,
      )
    })
  }

  return (
    <Stack gap={4}>
      {error === null ? null : <Alert message={error} />}

      <Card tone="outlined">
        <CardHeader title={companyName} />
        <CardBody>
          <Stack gap={4}>
            <p className={styles.note}>
              御社の配信と同じ業種のデータから、次の1本を3往復で決めます。
            </p>
            <div>
              <Button
                variant="accent"
                iconEnd="chevronRight"
                disabled={isPending}
                onClick={start}
              >
                {isPending ? '準備しています…' : 'この企業で始める'}
              </Button>
            </div>
          </Stack>
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
