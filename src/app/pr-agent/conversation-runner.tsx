'use client'

import { useRouter } from 'next/navigation'
import { useOptimistic, useState, useTransition } from 'react'

import type { Question, UserAnswer } from '@/feature/pr-agent'

import { AnswerBubble } from './answer'
import styles from './pr-agent.module.css'

/**
 * 回答の送信と、送信中の楽観的な描画。
 *
 * ストリーミングは入れないので、送信は fetch で Route Handler を 1 回叩くだけ。
 * 受け取った次のターンを自前で描かずに `router.refresh()` でサーバに描き直させているのは、
 * JSON を通ると Date が文字列になり、描画の型 (Turn) が崩れるため。
 * 描画の正をサーバ側 (prAgentFeature.get) に一本化しておくと、
 * 途中で再読み込みされても表示が変わらない。
 *
 * `useOptimistic` は transition が終わると自動で元に戻る。refresh の完了まで
 * transition が続くので、サーバの描画が届くまで利用者の回答が消えない。
 */
export function ConversationRunner({
  conversationId,
  question,
}: {
  conversationId: string
  /** 終端 (ターン 2) や終了済みの会話では null。質問を出さない */
  question: Question | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [sendingLabel, showSendingLabel] = useOptimistic<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [text, setText] = useState('')

  function send(answer: UserAnswer, label: string) {
    // 二重送信の防止。ボタンの disabled だけに任せない
    if (isPending) return
    setError(null)

    startTransition(async () => {
      showSendingLabel(label)

      let response: Response
      try {
        response = await fetch(
          `/api/pr-agent/conversations/${encodeURIComponent(conversationId)}/answers`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(answer),
          },
        )
      } catch {
        setError('通信に失敗しました。もう一度お試しください。')
        return
      }

      if (!response.ok) {
        setError(await errorMessageOf(response))
        return
      }

      setText('')
      router.refresh()
    })
  }

  return (
    <div className={styles.runner}>
      {sendingLabel === null ? null : (
        <AnswerBubble label={sendingLabel} pending />
      )}

      {error === null ? null : (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {question === null ? (
        <p className={styles.terminal}>ここまでです。</p>
      ) : (
        <form
          className={styles.question}
          onSubmit={(event) => {
            event.preventDefault()
            const free = text.trim()
            if (free === '') return
            send({ questionId: question.id, choiceId: null, text: free }, free)
          }}
        >
          <p className={styles.questionText}>{question.text}</p>

          <ul className={styles.choices}>
            {question.options.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  className={styles.choice}
                  disabled={isPending}
                  onClick={() => {
                    send(
                      {
                        questionId: question.id,
                        choiceId: option.id,
                        text: null,
                      },
                      option.label,
                    )
                  }}
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>

          <div className={styles.freeText}>
            <label htmlFor="pr-agent-other">その他</label>
            <input
              id="pr-agent-other"
              type="text"
              value={text}
              disabled={isPending}
              placeholder="選択肢に無いことはこちらへ"
              onChange={(event) => setText(event.target.value)}
            />
            <button
              type="submit"
              className={styles.submit}
              disabled={isPending || text.trim() === ''}
            >
              送信
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

/** 応答が JSON でない (502 など) こともあるので、読めなければ既定の文言に倒す */
async function errorMessageOf(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'string'
    ) {
      return body.error
    }
  } catch {
    // 読めないときは下の既定文言を使う
  }
  return '送信に失敗しました。時間をおいてお試しください。'
}
