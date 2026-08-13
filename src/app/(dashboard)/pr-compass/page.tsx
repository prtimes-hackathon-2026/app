'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '@/shared/ui'
import styles from './page.module.css'

type Block =
  | { type: 'stat'; items: { label: string; value: string }[] }
  | {
      type: 'bars'
      title: string
      unit: string
      items: { label: string; value: number }[]
      highlight?: string
      note?: string
    }
  | {
      type: 'compare'
      title: string
      left: { label: string; value: string }
      right: { label: string; value: string }
      note?: string
    }
  | {
      type: 'table'
      title: string
      columns: string[]
      rows: string[][]
      note?: string
    }
  | { type: 'goal'; headline: string; detail: string }
  | {
      type: 'checklist'
      title: string
      items: { label: string; withPct?: number; withoutPct?: number }[]
      note?: string
    }

type Message = {
  role: 'user' | 'assistant'
  content: string
  blocks?: Block[]
}

/** 数値は本文ではなくここから描く。言い換えで揺れないようにするため */
function Blocks({ blocks }: { blocks?: Block[] }) {
  if (!blocks?.length) return null
  const max = (items: { value: number }[]) =>
    Math.max(...items.map((i) => i.value), 1)

  return (
    <div className={styles.blocks}>
      {blocks.map((b, i) => {
        if (b.type === 'stat')
          return (
            <div key={i} className={styles.statRow}>
              {b.items.map((it) => (
                <div key={it.label} className={styles.stat}>
                  <div className={styles.statValue}>{it.value}</div>
                  <div className={styles.statLabel}>{it.label}</div>
                </div>
              ))}
            </div>
          )

        if (b.type === 'goal')
          return (
            <div key={i} className={styles.goal}>
              <div className={styles.goalHeadline}>{b.headline}</div>
              <div className={styles.goalDetail}>{b.detail}</div>
            </div>
          )

        if (b.type === 'bars')
          return (
            <div key={i} className={styles.card}>
              <div className={styles.cardTitle}>{b.title}</div>
              <div className={styles.bars}>
                {b.items.map((it) => (
                  <div key={it.label} className={styles.barCol}>
                    <span className={styles.barValue}>
                      {it.value}
                      {b.unit}
                    </span>
                    <div
                      className={`${styles.bar} ${it.label === b.highlight ? styles.barHi : ''}`}
                      style={{
                        height: `${Math.max((it.value / max(b.items)) * 100, 4)}%`,
                      }}
                    />
                    <span className={styles.barLabel}>{it.label}</span>
                  </div>
                ))}
              </div>
              {b.note && <p className={styles.cardNote}>{b.note}</p>}
            </div>
          )

        if (b.type === 'compare')
          return (
            <div key={i} className={styles.card}>
              <div className={styles.cardTitle}>{b.title}</div>
              <div className={styles.compare}>
                <div className={styles.compareSide}>
                  <div className={styles.compareValue}>{b.left.value}</div>
                  <div className={styles.compareLabel}>{b.left.label}</div>
                </div>
                <div className={styles.compareArrow}>→</div>
                <div className={styles.compareSide}>
                  <div
                    className={`${styles.compareValue} ${styles.compareValueHi}`}
                  >
                    {b.right.value}
                  </div>
                  <div className={styles.compareLabel}>{b.right.label}</div>
                </div>
              </div>
              {b.note && <p className={styles.cardNote}>{b.note}</p>}
            </div>
          )

        if (b.type === 'table')
          return (
            <div key={i} className={styles.card}>
              <div className={styles.cardTitle}>{b.title}</div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {b.columns.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, ri) => (
                      <tr key={ri}>
                        {r.map((c, ci) => (
                          <td key={ci}>{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {b.note && <p className={styles.cardNote}>{b.note}</p>}
            </div>
          )

        return (
          <div key={i} className={styles.card}>
            <div className={styles.cardTitle}>{b.title}</div>
            <ul className={styles.checklist}>
              {b.items.map((it) => (
                <li key={it.label}>
                  <span className={styles.checkLabel}>{it.label}</span>
                  {it.withPct !== undefined && it.withoutPct !== undefined && (
                    <span className={styles.checkDiff}>
                      使っている {it.withPct}% / 使っていない {it.withoutPct}%
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {b.note && <p className={styles.cardNote}>{b.note}</p>}
          </div>
        )
      })}
    </div>
  )
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
        <p
          className={`${styles.memoBody} ${loading ? styles.memoUpdating : ''}`}
        >
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
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<Phase>('discovery')
  const [memo, setMemo] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  // 音声。読み上げは任意機能で、失敗しても会話は続く
  const [autoSpeak, setAutoSpeak] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [recording, setRecording] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [speech, setSpeech] = useState('')

  const isComplete = phase === 'complete'

  // 初回AIメッセージを取得
  useEffect(() => {
    fetch('/api/pr-compass/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [] }),
    })
      .then((r) => r.json())
      .then(
        ({
          content,
          phase: p,
          memo: m,
          suggestions: s,
          speech: sp,
          blocks,
        }) => {
          setMessages([{ role: 'assistant', content, blocks }])
          if (p) setPhase(p as Phase)
          if (m) setMemo(m)
          setSuggestions(Array.isArray(s) ? s : [])
          setSpeech(sp ?? '')
        },
      )
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
    setSuggestions([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setLoading(true)

    try {
      const res = await fetch('/api/pr-compass/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })
      const { content, phase: p, memo: m, suggestions: s } = await res.json()

      setMessages([...newMessages, { role: 'assistant', content }])
      if (p) setPhase(p as Phase)
      if (m) setMemo(m)
      setSuggestions(Array.isArray(s) ? s : [])
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
    // 日本語入力の変換確定も Enter なので、変換中は送信しない。
    // これが無いと、変換のたびに送信されて文章が組み立てられなくなる
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  /** 台本を読み上げる。音が出せなくても会話は止めない */
  const play = useCallback(async (text: string) => {
    if (!text) return
    try {
      setSpeaking(true)
      const res = await fetch('/api/pr-compass/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (res.status === 204) return // 音声が無効。画面はそのまま進む
      const url = URL.createObjectURL(await res.blob())
      audioRef.current?.pause()
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        setSpeaking(false)
        URL.revokeObjectURL(url)
      }
      await audio.play()
    } catch {
      setSpeaking(false)
    }
  }, [])

  /** 話して答える。聞き取った文は入力欄に入れる（勝手に送信しない） */
  const toggleRecording = useCallback(async () => {
    if (recording) {
      recorderRef.current?.stop()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => chunks.push(e.data)
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        setRecording(false)
        const blob = new Blob(chunks, { type: recorder.mimeType })
        const res = await fetch('/api/pr-compass/stt', {
          method: 'POST',
          headers: { 'Content-Type': recorder.mimeType },
          body: blob,
        })
        const { text } = await res.json()
        if (text) {
          setInput(text)
          textareaRef.current?.focus()
        }
      }
      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch {
      setRecording(false)
    }
  }, [recording])

  /** サジェストは入力欄に入れるだけ。押しても送信はしない */
  const applySuggestion = (text: string) => {
    setInput(text)
    textareaRef.current?.focus()
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
              {m.role === 'assistant' && <Blocks blocks={m.blocks} />}
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
            {suggestions.length > 0 && !loading && (
              <div className={styles.suggestions}>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={styles.suggestion}
                    onClick={() => applySuggestion(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div className={styles.voiceBar}>
              <button
                type="button"
                className={styles.voiceBtn}
                onClick={() => play(speech)}
                disabled={speaking || !speech}
              >
                {speaking ? '🔊 読み上げ中…' : '🔊 いまの内容を読み上げる'}
              </button>
              <button
                type="button"
                className={`${styles.voiceBtn} ${recording ? styles.voiceBtnActive : ''}`}
                onClick={toggleRecording}
              >
                {recording ? '⏹ 話し終わったら押す' : '🎙 声で答える'}
              </button>
              <label className={styles.voiceToggle}>
                <input
                  type="checkbox"
                  checked={autoSpeak}
                  onChange={(e) => setAutoSpeak(e.target.checked)}
                />
                返答を自動で読み上げる
              </label>
            </div>
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
