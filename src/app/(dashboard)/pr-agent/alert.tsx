import { Icon } from '@/shared/ui'

import styles from './pr-agent.module.css'

/**
 * 送信の失敗などの通知。
 *
 * サーバ側 (会話が見つからない) とクライアント側 (通信の失敗) の両方から出るので、
 * AnswerBubble と同じく 'use client' を付けずどちらからも使える形にしている。
 * トークンに状態色 (danger) が無いため、色ではなく枠線とアイコンで本文と区別する。
 */
export function Alert({ message }: { message: string }) {
  return (
    <p className={styles.alert} role="alert">
      <Icon name="bell" size={16} />
      {message}
    </p>
  )
}
