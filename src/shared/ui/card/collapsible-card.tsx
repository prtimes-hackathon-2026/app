'use client'

import { useId, useState, type ReactNode } from 'react'
import { IconButton } from '../button/icon-button'
import { Card, CardBody, CardHeader } from './card'
import styles from './collapsible-card.module.css'

type CollapsibleCardProps = {
  title: ReactNode
  /** 初期状態で開くか。ダッシュボードのお知らせは既読相当のものを閉じて置く */
  defaultOpen?: boolean
  /** 右端に閉じる (×) を出すか */
  dismissible?: boolean
  children?: ReactNode
}

/**
 * ダッシュボードのお知らせ枠。開閉と非表示だけを持つ。
 * 本文は children なので、告知・案内・データ表示など中身を問わず使い回せる。
 */
export function CollapsibleCard({
  title,
  defaultOpen = true,
  dismissible = true,
  children,
}: CollapsibleCardProps) {
  const bodyId = useId()
  const [open, setOpen] = useState(defaultOpen)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <Card>
      <CardHeader
        title={title}
        actions={
          <>
            <IconButton
              icon={open ? 'chevronUp' : 'chevronDown'}
              label={open ? '閉じる' : '開く'}
              aria-expanded={open}
              aria-controls={bodyId}
              onClick={() => setOpen((value) => !value)}
              muted
            />
            {dismissible && (
              <IconButton
                icon="close"
                label="このお知らせを非表示にする"
                onClick={() => setDismissed(true)}
                muted
              />
            )}
          </>
        }
      />
      <div id={bodyId} hidden={!open}>
        {children && (
          <CardBody className={styles.body}>
            <div className={styles.text}>{children}</div>
          </CardBody>
        )}
      </div>
    </Card>
  )
}
