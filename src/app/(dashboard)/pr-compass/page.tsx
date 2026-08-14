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
      type: 'articles'
      title: string
      items: {
        title: string
        url: string
        why: string
        points?: string[]
      }[]
    }
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

        if (b.type === 'articles')
          return (
            <div key={i} className={styles.card}>
              <div className={styles.cardTitle}>{b.title}</div>
              <ul className={styles.articles}>
                {b.items.map((a) => (
                  <li key={a.url}>
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.articleLink}
                    >
                      {a.title}
                    </a>
                    <span className={styles.articleWhy}>{a.why}</span>
                    {!!a.points?.length && (
                      <div className={styles.articlePoints}>
                        <span className={styles.articlePointsLabel}>
                          記事から抜き出した要点
                        </span>
                        <ul>
                          {a.points.map((point) => (
                            <li key={point}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
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

/**
 * 本文は1本の文字列で届く。段落は空行、箇条書きは改行で区切られているので、
 * そのまま流し込むと HTML が改行を潰して1段落に見えてしまう。ここで組み直す。
 */
function Paragraphs({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  return paragraphs.map((p, i) => (
    <p key={i} className={styles.paragraph}>
      {p}
    </p>
  ))
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
  const [isOpen, setIsOpen] = useState(false)

  const badgeClass =
    phase === 'discovery'
      ? styles.phaseBadgeDiscovery
      : phase === 'free_talk'
        ? styles.phaseBadgeFreeTalk
        : styles.phaseBadgeProposal

  return (
    <>
      <button
        type="button"
        className={`${styles.mobileMemoFab} ${isOpen ? styles.hidden : ''}`}
        onClick={() => setIsOpen(true)}
        aria-label="メモを開く"
      >
        <Icon name="form" size={20} />
      </button>

      <aside
        className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : styles.sidebarClosed}`}
      >
        <div className={styles.memoHeader}>
          <div className={styles.memoHeaderTitle}>
            <Icon name="form" size={14} />
            <span className={styles.memoHeaderLabel}>聞き取りメモ</span>
          </div>

          <div className={styles.memoHeaderRight}>
            {phase !== 'complete' && (
              <span className={`${styles.phaseBadge} ${badgeClass}`}>
                {PHASE_LABELS[phase]}
              </span>
            )}
            <button
              type="button"
              className={styles.memoCloseBtn}
              onClick={() => setIsOpen(false)}
              aria-label="メモを閉じる"
            >
              ✕
            </button>
          </div>
        </div>

        {memo ? (
          // メモは「・」始まりの1行1項目で届く。行ごとに組まないと1行に繋がって読めない
          <div
            className={`${styles.memoBody} ${loading ? styles.memoUpdating : ''}`}
          >
            {memo
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line, i) => (
                <p key={i} className={styles.memoItem}>
                  {line}
                </p>
              ))}
          </div>
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
    </>
  )
}

export default function PrCompassPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [phase, setPhase] = useState<Phase>('discovery')
  const [memo, setMemo] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  // 音声は任意機能。失敗してもテキストの会話は続く
  const [autoSpeak, setAutoSpeak] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [recording, setRecording] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const speechAbortRef = useRef<AbortController | null>(null)
  const speechRequestRef = useRef(0)
  const lastAutoSpokenIndexRef = useRef(-1)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const conversationStartedRef = useRef(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isComplete = phase === 'complete'

  // 初回AIメッセージを取得
  useEffect(() => {
    const controller = new AbortController()
    let active = true

    async function requestAnalysis(analysisMode: 'initial' | 'full') {
      const startedAt = performance.now()
      const response = await fetch('/api/pr-compass/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [], analysisMode }),
        signal: controller.signal,
      })
      const payload = await response.json()
      console.info(
        '[pr-compass:timing]',
        JSON.stringify({
          stage: `${analysisMode}-fetch`,
          status: response.status,
          durationMs: Math.round(performance.now() - startedAt),
        }),
      )
      if (!response.ok) throw new Error(`chat failed: ${response.status}`)
      return payload
    }

    async function initialize() {
      try {
        const {
          content,
          phase: p,
          memo: m,
          suggestions: s,
          blocks,
        } = await requestAnalysis('initial')
        if (!active) return

        setMessages([{ role: 'assistant', content, blocks }])
        if (p) setPhase(p as Phase)
        if (m) setMemo(m)
        setSuggestions(Array.isArray(s) ? s : [])
        setLoading(false)
      } catch (error) {
        if (!active) return
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setMessages([
            {
              role: 'assistant',
              content:
                '申し訳ありません。接続に問題が発生しました。しばらく経ってから再度お試しください。',
            },
          ])
        }
        setLoading(false)
        return
      }

      setAnalysisLoading(true)
      try {
        const {
          content,
          phase: p,
          memo: m,
          suggestions: s,
          blocks,
        } = await requestAnalysis('full')
        if (!active || conversationStartedRef.current) return

        setMessages([{ role: 'assistant', content, blocks }])
        if (p) setPhase(p as Phase)
        if (m) setMemo(m)
        setSuggestions(Array.isArray(s) ? s : [])
      } catch (error) {
        // 完全分析が失敗しても、先に表示した企業固有の現在地は残す。
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('PR Compass initial analysis error:', error)
        }
      } finally {
        if (active) setAnalysisLoading(false)
      }
    }

    void initialize()
    return () => {
      active = false
      controller.abort()
    }
  }, [])

  // 最下部へスクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, analysisLoading])

  // テキストエリアの高さ自動調整
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }

  /** 準備中のリクエストを含めて、現在の音声を止める */
  const stopSpeaking = useCallback(() => {
    speechRequestRef.current += 1
    speechAbortRef.current?.abort()
    speechAbortRef.current = null

    if (audioRef.current) {
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current.pause()
      audioRef.current = null
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
    setSpeaking(false)
  }, [])

  /** 表示済みチャットを渡し、その返答について会話調で話してもらう */
  const play = useCallback(
    async (message: Message, context: readonly Message[]) => {
      const text = message.content.trim()
      if (!text) return

      stopSpeaking()
      const requestId = speechRequestRef.current + 1
      speechRequestRef.current = requestId
      const controller = new AbortController()
      speechAbortRef.current = controller
      setSpeaking(true)

      const finish = () => {
        if (speechRequestRef.current !== requestId) return
        speechAbortRef.current = null
        audioRef.current = null
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current)
          audioUrlRef.current = null
        }
        setSpeaking(false)
      }

      try {
        const res = await fetch('/api/pr-compass/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, messages: context.slice(-8) }),
          signal: controller.signal,
        })
        if (res.status === 204 || !res.ok) {
          finish()
          return
        }

        const url = URL.createObjectURL(await res.blob())
        if (speechRequestRef.current !== requestId) {
          URL.revokeObjectURL(url)
          return
        }

        audioUrlRef.current = url
        const audio = new Audio(url)
        audioRef.current = audio
        audio.onended = finish
        audio.onerror = finish
        await audio.play()
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('PR Compass voice playback error:', error)
        }
        finish()
      }
    },
    [stopSpeaking],
  )

  // ONの間は、追加されたすべてのAI返答を1回ずつ音声でも返す。
  useEffect(() => {
    if (!autoSpeak) return

    let latestIndex = -1
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === 'assistant') {
        latestIndex = i
        break
      }
    }
    if (latestIndex < 0 || latestIndex <= lastAutoSpokenIndexRef.current) return

    const latest = messages[latestIndex]
    if (!latest) return
    const timeout = window.setTimeout(() => {
      if (latestIndex <= lastAutoSpokenIndexRef.current) return
      lastAutoSpokenIndexRef.current = latestIndex
      void play(latest, messages)
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [autoSpeak, messages, play])

  // ページを離れた後に音声やfetchを残さない。
  useEffect(
    () => () => {
      speechRequestRef.current += 1
      speechAbortRef.current?.abort()
      audioRef.current?.pause()
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    },
    [],
  )

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading || isComplete) return
    conversationStartedRef.current = true
    stopSpeaking()

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
      const {
        content,
        phase: p,
        memo: m,
        suggestions: s,
        blocks,
      } = await res.json()

      setMessages([...newMessages, { role: 'assistant', content, blocks }])
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
  }, [input, loading, isComplete, messages, stopSpeaking])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 日本語入力の変換確定も Enter なので、変換中は送信しない。
    // これが無いと、変換のたびに送信されて文章が組み立てられなくなる
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  /** 話して答える。聞き取った文は入力欄に入れる（勝手に送信しない） */
  const toggleRecording = useCallback(async () => {
    if (recording) {
      recorderRef.current?.stop()
      return
    }
    try {
      stopSpeaking()
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
  }, [recording, stopSpeaking])

  /** サジェストは入力欄に入れるだけ。押しても送信はしない */
  const applySuggestion = (text: string) => {
    setInput(text)
    textareaRef.current?.focus()
  }

  let latestAssistant: Message | undefined
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'assistant') {
      latestAssistant = messages[i]
      break
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
              <div className={styles.bubbleInner}>
                <Paragraphs text={m.content} />
                {m.role === 'assistant' && <Blocks blocks={m.blocks} />}
              </div>
            </div>
          ))}

          {(loading || analysisLoading) && <TypingDots />}

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
                onClick={() => {
                  if (speaking) {
                    stopSpeaking()
                  } else if (latestAssistant) {
                    void play(latestAssistant, messages)
                  }
                }}
                disabled={!speaking && !latestAssistant}
              >
                {speaking ? '⏹ 音声を止める' : '🔊 この返答について聞く'}
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
                  onChange={(e) => {
                    const checked = e.target.checked
                    if (!checked) {
                      lastAutoSpokenIndexRef.current = -1
                      stopSpeaking()
                    }
                    setAutoSpeak(checked)
                  }}
                />
                AI音声で返答を続ける
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
