'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '@/shared/ui'
import styles from './page.module.css'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

type Phase = 'discovery' | 'free_talk' | 'proposal' | 'complete'

const PHASE_LABELS: Record<Phase, string> = {
  discovery: '聞き取り中',
  free_talk: '追加確認',
  proposal: '提案中',
  complete: '完了',
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

/** 左パネル：聞き取りメモ */
function MemoPanel({
  memo,
  phase,
  loading,
}: {
  memo: string
  phase: Phase
  loading: boolean
}) {
  const badgeClass =
    phase === 'discovery'
      ? styles.phaseBadgeDiscovery
      : phase === 'free_talk'
        ? styles.phaseBadgeFreeTalk
        : styles.phaseBadgeProposal

  return (
    <aside className={styles.sidebar}>
      <div className={styles.memoHeader}>
        <Icon name="form" size={14} />
        <span className={styles.memoHeaderLabel}>聞き取りメモ</span>

        {phase !== 'complete' && (
          <span className={`${styles.phaseBadge} ${badgeClass}`}>
            {PHASE_LABELS[phase]}
          </span>
        )}
      </div>

      {memo ? (
        <p className={`${styles.memoBody} ${loading ? styles.memoUpdating : ''}`}>
          {memo}
        </p>
      ) : (
        <div className={styles.memoEmpty}>
          <div className={styles.memoEmptyIcon}>
            <Icon name="form" size={16} />
          </div>
          <span>
            会話が進むにつれて、
            <br />
            ここに内容が記録されていきます。
          </span>
        </div>
      )}
    </aside>
  )
}

export default function PrCompassPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [phase, setPhase] = useState<Phase>('discovery')
  const [memo, setMemo] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isComplete = phase === 'complete'

  // 初回AIメッセージを取得
  useEffect(() => {
    setLoading(true)
    fetch('/api/pr-compass/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [] }),
    })
      .then((r) => r.json())
      .then(({ content, phase: p, memo: m }) => {
        setMessages([{ role: 'assistant', content }])
        if (p) setPhase(p as Phase)
        if (m) setMemo(m)
      })
      .catch(() => {
        setMessages([
          {
            role: 'assistant',
            content:
              '申し訳ありません。接続に問題が発生しました。しばらく経ってから再度お試しください。',
          },
        ])
      })
      .finally(() => setLoading(false))
  }, [])

  // 最下部へスクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // テキストエリアの高さ自動調整
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading || isComplete) return

    const newMessages: Message[] = [
      ...messages,
      { role: 'user', content: text },
    ]
    setMessages(newMessages)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setLoading(true)

    try {
      const res = await fetch('/api/pr-compass/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })
      const { content, phase: p, memo: m } = await res.json()

      setMessages([...newMessages, { role: 'assistant', content }])
      if (p) setPhase(p as Phase)
      if (m) setMemo(m)
    } catch {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: 'エラーが発生しました。もう一度送信してください。',
        },
      ])
    } finally {
      setLoading(false)
    }
  }, [input, loading, isComplete, messages])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className={styles.page}>
      {/* ── 左パネル ─────────────────── */}
      <MemoPanel memo={memo} phase={phase} loading={loading} />

      {/* ── 右パネル：チャット ──────── */}
      <section className={styles.chat}>
        <div className={styles.messages}>
          {messages.map((m, i) => (
            <div
              key={i}
              className={`${styles.bubble} ${
                m.role === 'assistant' ? styles.bubbleAi : styles.bubbleUser
              }`}
            >
              <p className={styles.bubbleLabel}>
                {m.role === 'assistant' ? 'PR TIMES 広報伴走AI' : 'あなた'}
              </p>
              <div className={styles.bubbleInner}>{m.content}</div>
            </div>
          ))}

          {loading && <TypingDots />}

          {isComplete && (
            <div className={styles.completeBanner}>
              <Icon name="send" size={18} />
              <p className={styles.completeBannerText}>
                広報の方針が固まりました。プレスリリース作成に進みましょう。
              </p>
              <Link
                href="/press-releases/new"
                style={{
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 'var(--fw-bold)',
                  color: 'var(--c-primary)',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                作成する →
              </Link>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {!isComplete && (
          <div className={styles.inputArea}>
            <div className={styles.inputRow}>
              <textarea
                ref={textareaRef}
                className={styles.textarea}
                placeholder={
                  phase === 'free_talk'
                    ? '他に伝えておきたいことがあれば… （なければ「大丈夫です」でも）'
                    : '返信を入力… （Shift+Enter で改行）'
                }
                rows={1}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={loading}
              />
              <button
                type="button"
                className={styles.sendBtn}
                onClick={send}
                disabled={loading || !input.trim()}
                aria-label="送信"
              >
                <Icon name="send" size={18} />
              </button>
            </div>
            <p className={styles.hintText}>Enter で送信 / Shift+Enter で改行</p>
          </div>
        )}
      </section>
    </div>
  )
}
