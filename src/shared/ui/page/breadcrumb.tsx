import Link from 'next/link'
import { Icon } from '../icon/icon'
import styles from './breadcrumb.module.css'

export type Crumb = {
  label: string
  /** 省略すると現在地としてリンクなしで描画する */
  href?: string
}

type BreadcrumbProps = {
  items: Crumb[]
}

/** 現在地のパンくず。項目はナビゲーション定義から自動で組み立てられる */
export function Breadcrumb({ items }: BreadcrumbProps) {
  if (items.length === 0) return null

  return (
    <nav aria-label="パンくずリスト">
      <ol className={styles.list}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${item.label}-${index}`} className={styles.item}>
              {item.href && !isLast ? (
                <Link href={item.href} className={styles.chip}>
                  {item.label}
                </Link>
              ) : (
                <span className={styles.chip} aria-current={isLast && 'page'}>
                  {item.label}
                </span>
              )}
              {!isLast && (
                <Icon
                  name="chevronRight"
                  size={14}
                  className={styles.separator}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
