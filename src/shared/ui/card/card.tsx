import { type ReactNode } from 'react'
import { cx } from '../cx'
import styles from './card.module.css'

export type CardTone = 'muted' | 'outlined'

type CardProps = {
  tone?: CardTone
  className?: string
  children: ReactNode
}

/**
 * 画面に置く箱の最小単位。
 * 角丸・下地の指定はここだけが持ち、中身の構造は CardHeader / CardBody に任せる。
 */
export function Card({ tone = 'muted', className, children }: CardProps) {
  return (
    <section className={cx(styles.card, styles[tone], className)}>
      {children}
    </section>
  )
}

type CardHeaderProps = {
  title: ReactNode
  /** 右端に並べる操作 (開閉・閉じるなど) */
  actions?: ReactNode
  /** 見出しの HTML タグ。ページ内の見出し階層に合わせて変える */
  as?: 'h2' | 'h3' | 'h4'
}

export function CardHeader({
  title,
  actions,
  as: Tag = 'h2',
}: CardHeaderProps) {
  return (
    <div className={styles.header}>
      <Tag className={styles.title}>{title}</Tag>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  )
}

type CardBodyProps = {
  /** CardHeader を持たないカードで上の余白を補う */
  standalone?: boolean
  className?: string
  children: ReactNode
}

export function CardBody({ standalone, className, children }: CardBodyProps) {
  return (
    <div className={cx(styles.body, standalone && styles.bodyOnly, className)}>
      {children}
    </div>
  )
}
