import type { ReactNode } from 'react'

import { brand } from '@/shared/app-config'
import { cx, Icon } from '@/shared/ui'

import styles from './login.module.css'

/**
 * ログインの 2 つの画面が共有する枠。
 *
 * 管理画面の骨組み (AppShell) はログイン後の画面のためのものなので、ここでは使わない。
 * サイドバーもヘッダーも出さず、名乗りと本文だけを中央に置く。
 */
export function LoginPanel({
  title,
  description,
  wide,
  children,
}: {
  title: string
  description: string
  /** 企業の一覧のように横幅が要る画面で広げる */
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div className={styles.page}>
      <main className={cx(styles.panel, wide && styles.wide)}>
        <p className={styles.brand}>{brand.name}</p>
        <div className={styles.heading}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.description}>{description}</p>
        </div>
        {children}
      </main>
    </div>
  )
}

/**
 * 送信の失敗などの通知。
 * ログイン画面は AppShell の外にあり pr-compass の Alert を借りられないので、
 * 同じ考え方 (色に頼らず枠線とアイコンで区別する) の小さな版をここに置く。
 */
export function LoginError({ message }: { message: string }) {
  return (
    <p className={styles.error} role="alert">
      <Icon name="bell" size={16} />
      {message}
    </p>
  )
}
