'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { IconButton } from '../button/icon-button'
import { cx } from '../cx'
import { Icon } from '../icon/icon'
import { findNavTrail, isPathActive, type NavItem } from './navigation'
import styles from './side-nav.module.css'

type SideNavProps = {
  items: NavItem[]
  /** アイコンだけの細い表示にするか */
  rail?: boolean
  /** 遷移したことを親に伝える (画面が狭いときにドロワーを閉じる用) */
  onNavigate?: () => void
  className?: string
}

/**
 * 左サイドのメニュー。
 * 項目は props の定義そのままで、現在地の判定と開閉だけをここが持つ。
 */
export function SideNav({
  items,
  rail = false,
  onNavigate,
  className,
}: SideNavProps) {
  const pathname = usePathname()
  // 現在地までの道筋。要素そのものが入っているので同一 URL の項目とも取り違えない
  const trail = new Set(findNavTrail(items, pathname))

  // 既定では現在地を含むメニューだけを開く。手で開閉したものはその指定を優先する
  const [manuallyToggled, setManuallyToggled] = useState<
    Record<string, boolean>
  >({})

  return (
    <nav
      aria-label="メインメニュー"
      className={cx(styles.nav, rail && styles.rail, className)}
    >
      <ul className={styles.list}>
        {items.map((item) => {
          const active = isPathActive(pathname, item.href)
          const hasChildren = Boolean(item.children?.length)
          const expanded = manuallyToggled[item.href] ?? trail.has(item)

          return (
            <li key={item.href}>
              <div className={styles.row} data-active={active}>
                <Link
                  href={item.href}
                  className={styles.link}
                  title={rail ? item.label : undefined}
                  aria-current={active && 'page'}
                  onClick={onNavigate}
                >
                  {item.icon && (
                    <Icon name={item.icon} size={22} className={styles.icon} />
                  )}
                  <span className={styles.label}>{item.label}</span>
                </Link>

                {hasChildren && (
                  <IconButton
                    icon={expanded ? 'chevronDown' : 'chevronRight'}
                    label={`${item.label}のメニューを${expanded ? '閉じる' : '開く'}`}
                    size="sm"
                    iconSize={16}
                    aria-expanded={expanded}
                    className={styles.toggle}
                    onClick={() =>
                      setManuallyToggled((current) => ({
                        ...current,
                        [item.href]: !expanded,
                      }))
                    }
                  />
                )}
              </div>

              {hasChildren && expanded && (
                <ul className={styles.subList}>
                  {item.children?.map((child) => (
                    <li key={child.href}>
                      <Link
                        href={child.href}
                        className={styles.subLink}
                        data-active={trail.has(child)}
                        onClick={onNavigate}
                      >
                        {child.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
