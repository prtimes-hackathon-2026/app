'use client'

import { useState, type ReactNode } from 'react'
import { LinkButton } from '../button/button'
import { IconButton } from '../button/icon-button'
import { Card } from '../card/card'
import { Icon, type IconName } from '../icon/icon'
import styles from './callout.module.css'

type CalloutProps = {
  title: ReactNode
  icon?: IconName
  /** 右端に置く導線。1 つだけ置けるようにして、押し先を迷わせない */
  action?: { label: string; href: string }
  dismissible?: boolean
  children?: ReactNode
}

/**
 * 並んだお知らせ枠の中で 1 つだけ目を引かせたいときの箱。
 *
 * 「久しぶりに来た人を目的の再確認に戻す」のような、
 * 読み流されると困る 1 件をページ先頭に置くために使う。
 */
export function Callout({
  title,
  icon,
  action,
  dismissible = true,
  children,
}: CalloutProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <Card tone="accent">
      <div className={styles.inner}>
        {icon && (
          <span className={styles.icon}>
            <Icon name={icon} size={24} />
          </span>
        )}

        <div className={styles.text}>
          <h2 className={styles.title}>{title}</h2>
          {children && <div className={styles.body}>{children}</div>}
        </div>

        {action && (
          <LinkButton
            href={action.href}
            variant="solid"
            iconEnd="chevronRight"
            className={styles.action}
          >
            {action.label}
          </LinkButton>
        )}

        {dismissible && (
          <IconButton
            icon="close"
            label="この案内を非表示にする"
            onClick={() => setDismissed(true)}
            className={styles.close}
            muted
          />
        )}
      </div>
    </Card>
  )
}
