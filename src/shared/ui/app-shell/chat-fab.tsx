'use client'

import { useState } from 'react'
import { IconButton } from '../button/icon-button'
import { Icon } from '../icon/icon'
import styles from './chat-fab.module.css'

type ChatFabProps = {
  label?: string
  onOpen?: () => void
}

/** 右下に浮かぶ問い合わせボタン。× で消せる */
export function ChatFab({
  label = 'チャットで質問する',
  onOpen,
}: ChatFabProps) {
  const [hidden, setHidden] = useState(false)

  if (hidden) return null

  return (
    <div className={styles.wrapper}>
      <IconButton
        icon="close"
        label="チャットを閉じる"
        size="sm"
        iconSize={14}
        className={styles.close}
        onClick={() => setHidden(true)}
      />
      <button
        type="button"
        aria-label={label}
        title={label}
        className={styles.button}
        onClick={onOpen}
      >
        <Icon name="chat" size={26} />
      </button>
    </div>
  )
}
