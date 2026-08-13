'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

import type { Question, UserAnswer } from '@/feature/pr-agent'
import { Icon } from '@/shared/ui'

import { Alert } from './alert'
import { UserBubble } from './bubble'
import styles from './page.module.css'

/**
 * 右パネル：チャット本体。回答の送信と、送信中の楽観的な描画を持つ。
 *
 * ストリーミングは入れないので、送信は fetch で Route Handler を 1 回叩くだけ。
 * 受け取った次のターンを自前で描かずに `router.refresh()` でサーバに描き直させているのは、
 * JSON を通ると Date が文字列になり、描画の型 (Turn) が崩れるため。
 * 描画の正をサーバ側 (prAgentFeature.get) に一本化しておくと、
 * 途中で再読み込みされても表示が変わらない。
 *
 * これまでの履歴はサーバが描いて `children` で渡ってくる。楽観的な表示と入力欄だけが
 * クライアント側にあり、両方を同じ列に並べるためにこの器がチャット全体を包んでいる。
 *
 * `useOptimistic` は transition が終わると自動で元に戻る。refresh の完了まで
 * transition が続くので、サーバの描画が届くまで利用者の回答が消えない。
 */
export function ChatPanel({
  conversationId,
  question,
  completed,
  children,
}: {
  conversationId: string
  /** 終端 (ターン 2) や終了済みの会話では null。入力欄ごと出さない */
  question: Question | null
  completed: boolean
  children: ReactNode
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [sendingLabel, showSendingLabel] = useOptimistic<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 送信の直後と、サーバの描画が届いた直後の 2 回走る。
  // refresh の完了まで transition が続くので isPending の変化がその合図になる
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [isPending])

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
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      router.refresh()
    })
  }

  function sendFreeText() {
    const free = text.trim()
    // 自由入力はバックエンドの Classifier が 4 分類に割り当てる。言い直させない
    if (free === '' || question === null) return
    send({ questionId: question.id, choiceId: null, text: free }, free)
  }

  function handleInputChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setText(event.target.value)
    // 入力に合わせて高さを伸ばす。上限は CSS の max-height と揃えている
    const element = event.target
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 140)}px`
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendFreeText()
    }
  }

  return (
    <>
      <div className={styles.messages}>
        {children}

        {sendingLabel === null ? null : (
          <UserBubble label={sendingLabel} pending />
        )}

        {isPending ? <TypingDots /> : null}

        {error === null ? null : <Alert message={error} />}

        {completed ? (
          <div className={styles.completeBanner}>
            <Icon name="send" size={18} />
            <p className={styles.completeBannerText}>
              広報の方針が固まりました。プレスリリース作成に進みましょう。
            </p>
            <Link
              href="/press-releases/new"
              className={styles.completeBannerLink}
            >
              作成する →
            </Link>
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>

      {question === null ? null : (
        <div className={styles.inputArea}>
          <div className={styles.inputInner}>
            {/* 1 ターンに質問は 1 つ (設計 §1)。選択肢と自由入力で 1 つの答えを受ける */}
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

            <div className={styles.inputRow}>
              <textarea
                ref={textareaRef}
                className={styles.textarea}
                placeholder="選択肢に無いことは、そのまま書いてください"
                rows={1}
                value={text}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={isPending}
              />
              <button
                type="button"
                className={styles.sendBtn}
                onClick={sendFreeText}
                disabled={isPending || text.trim() === ''}
                aria-label="送信"
              >
                <Icon name="send" size={18} />
              </button>
            </div>

            <p className={styles.hintText}>Enter で送信 / Shift+Enter で改行</p>
          </div>
        </div>
      )}
    </>
  )
}

function TypingDots() {
  return (
    <div className={styles.typing}>
      <span className={styles.typingDot} />
      <span className={styles.typingDot} />
      <span className={styles.typingDot} />
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
