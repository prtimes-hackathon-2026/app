import type { Question, UserAnswer } from '@/feature/pr-agent'
import { cx, Icon } from '@/shared/ui'

import styles from './pr-agent.module.css'

/**
 * 利用者の回答の表示。
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

export function AnswerBubble({
  label,
  pending = false,
}: {
  label: string
  pending?: boolean
}) {
  return (
    <p className={cx(styles.answer, pending && styles.pending)}>
      <span className={styles.answerRole}>
        <Icon name="account" size={14} />
        あなた
      </span>
      <span>{label}</span>
      {pending ? <span className={styles.answerState}>送信中…</span> : null}
    </p>
  )
}
