import type { Question, Turn, UserAnswer } from '@/feature/pr-agent'
import { cx } from '@/shared/ui'

import styles from './page.module.css'
import { TurnView, type HitCurveBlock } from './turn-view'

/**
 * 会話の吹き出し。
 *
 * サーバが描く履歴と、送信中にクライアントが先に描く楽観的な表示とで
 * 見た目がずれないよう、どちらからも使える形 ('use client' を付けない) で切り出している。
 */

/** 選んだ選択肢のラベルは質問側にしか無いので、回答と突き合わせて解決する */
export function answerLabel(
  answer: UserAnswer,
  question: Question | undefined,
): string {
  const chosen = question?.options.find(
    (option) => option.id === answer.choiceId,
  )
  return chosen?.label ?? answer.text ?? '(回答なし)'
}

/** AI の発話。1 ターンぶんの文章と提示物がまるごと 1 つの吹き出しに入る */
export function AgentBubble({
  turn,
  hitCurveFallback,
}: {
  turn: Turn
  /** 前のターンで出した当たり率カーブ。期間カーブと並べるために借りてくる */
  hitCurveFallback: HitCurveBlock | undefined
}) {
  return (
    <article className={cx(styles.bubble, styles.bubbleAi)}>
      <p className={styles.bubbleLabel}>PR TIMES 広報伴走AI</p>
      <div className={styles.bubbleInner}>
        <TurnView turn={turn} hitCurveFallback={hitCurveFallback} />
      </div>
    </article>
  )
}

/** 利用者の発話。選んだ選択肢のラベル、または自由入力した文章がそのまま入る */
export function UserBubble({
  label,
  pending = false,
}: {
  label: string
  /** 送信中。サーバの描画が返るまでの仮表示であることを見た目で示す */
  pending?: boolean
}) {
  return (
    <div className={cx(styles.bubble, styles.bubbleUser)}>
      <p className={styles.bubbleLabel}>
        あなた
        {pending ? <span className={styles.bubbleState}>送信中…</span> : null}
      </p>
      <div className={cx(styles.bubbleInner, pending && styles.bubblePending)}>
        {label}
      </div>
    </div>
  )
}
