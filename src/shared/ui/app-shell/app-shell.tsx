'use client'

import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { IconButton } from '../button/icon-button'
import { cx } from '../cx'
import { Breadcrumb } from '../page/breadcrumb'
import { AppHeader } from './app-header'
import { ChatFab } from './chat-fab'
import styles from './app-shell.module.css'
import {
  findNavTrail,
  toCrumbs,
  type AccountInfo,
  type BrandInfo,
  type HeaderAction,
  type NavItem,
  type SupportInfo,
} from './navigation'
import { SideNav } from './side-nav'

/** この幅を下回ったらサイドバーを引き出し扱いにする */
const COMPACT_QUERY = '(max-width: 899px)'

export type AppShellProps = {
  brand: BrandInfo
  navigation: NavItem[]
  actions?: HeaderAction[]
  support?: SupportInfo
  account?: AccountInfo
  /** アカウントの右隣に置く操作 (ログアウトなど) */
  accountAction?: ReactNode
  /** 管理者画面など、企業向けチャットを置かない画面では false */
  showChat?: boolean
  children: ReactNode
}

/**
 * 全画面共通の骨組み。ヘッダー・サイドバー・パンくず・本文の位置関係をここだけが持つ。
 *
 * 各ページは中身 (children) を書くことだけに集中すればよく、
 * パンくずは navigation の定義と現在の URL から自動で組み立てられる。
 */
export function AppShell({
  brand,
  navigation,
  actions,
  support,
  account,
  accountAction,
  showChat = true,
  children,
}: AppShellProps) {
  const pathname = usePathname()
  const crumbs = toCrumbs(findNavTrail(navigation, pathname))

  const [navOpen, setNavOpen] = useState(true)
  const [compact, setCompact] = useState(false)

  // 画面幅に応じた既定値。狭いときは閉じた状態から始める
  useEffect(() => {
    const query = window.matchMedia(COMPACT_QUERY)
    const apply = (isCompact: boolean) => {
      setCompact(isCompact)
      setNavOpen(!isCompact)
    }

    apply(query.matches)
    const onChange = (event: MediaQueryListEvent) => apply(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  // 引き出し表示のときは、遷移したら閉じる
  const closeOnNavigate = useCallback(() => {
    if (compact) setNavOpen(false)
  }, [compact])

  return (
    <div className={cx(styles.shell, !navOpen && styles.navClosed)}>
      <AppHeader
        brand={brand}
        actions={actions}
        support={support}
        account={account}
        accountAction={accountAction}
      />

      <div className={styles.body}>
        {/* 位置取り (sticky / 引き出し) はこの器が持ち、中身の見た目は SideNav が持つ。
            同じ要素を 2 つの CSS Module から触ると打ち消し合うため器を挟んでいる */}
        <div className={styles.sidebar}>
          <SideNav
            items={navigation}
            rail={!navOpen && !compact}
            onNavigate={closeOnNavigate}
          />
        </div>

        {compact && navOpen && (
          <button
            type="button"
            aria-label="メニューを閉じる"
            className={styles.backdrop}
            onClick={() => setNavOpen(false)}
          />
        )}

        <div className={styles.content}>
          <div className={styles.topbar}>
            <IconButton
              icon="menuFold"
              label={navOpen ? 'メニューを閉じる' : 'メニューを開く'}
              aria-expanded={navOpen}
              iconSize={20}
              onClick={() => setNavOpen((value) => !value)}
            />
            <Breadcrumb items={crumbs} />
          </div>

          <main className={styles.main}>{children}</main>
        </div>
      </div>

      {showChat && <ChatFab />}
    </div>
  )
}
