import Link from 'next/link'

import type { TurnNumber } from '@/feature/pr-agent'
import { companySelectPath } from '@/shared/auth'
import { cx, Icon } from '@/shared/ui'

import { isMemoEmpty, type MemoItem } from './memo'
import styles from './page.module.css'

/**
 * 左パネル：聞き取りメモ。
 *
 * 中身は `memo.ts` が会話から決定的に組み立てたものをそのまま並べるだけ。
 * 項目の並びは空欄も含めて常に同じで、会話が進むほど埋まっていく。
 */

/**
 * ターンごとのバッジの文言。会話は 0 → 1 → 2 の 3 つしかないので、
 * Record にして増減がここで型エラーになるようにしている (設計 §1)。
 */
const TURN_LABELS: Record<TurnNumber, string> = {
  0: '現在地の確認',
  1: '目標の確認',
  2: '最初の一手',
}

const TURN_BADGE_CLASSES: Record<TurnNumber, string | undefined> = {
  0: styles.phaseBadgeTurn0,
  1: styles.phaseBadgeTurn1,
  2: styles.phaseBadgeTurn2,
}

export function MemoPanel({
  items,
  turn,
  completed,
  /** 会話が始まっているときだけ「別の企業で試す」を出す */
  started,
}: {
  items: readonly MemoItem[]
  turn: TurnNumber
  completed: boolean
  started: boolean
}) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.memoHeader}>
        <Icon name="form" size={14} />
        <span className={styles.memoHeaderLabel}>聞き取りメモ</span>

        {completed ? null : (
          <span className={cx(styles.phaseBadge, TURN_BADGE_CLASSES[turn])}>
            {TURN_LABELS[turn]}
          </span>
        )}
      </div>

      {isMemoEmpty(items) ? (
        <div className={styles.memoEmpty}>
          <div className={styles.memoEmptyIcon}>
            <Icon name="form" size={16} />
          </div>
          <span>
            会話が進むにつれて、
            <br />
            ここに内容が記録されていきます。
          </span>
        </div>
      ) : (
        <dl className={styles.memoBody}>
          {items.map((item) => (
            <div key={item.label} className={styles.memoRow}>
              <dt className={styles.memoLabel}>{item.label}</dt>
              <dd
                className={
                  item.value === null ? styles.memoValueEmpty : styles.memoValue
                }
              >
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {/*
        どの企業として見ているかはログインで決まっている (設計 §11(a) の解消)。
        企業を変えたくなったときの行き先も、迷わないようにここに出しておく。
      */}
      <div className={styles.memoFooter}>
        <p className={styles.memoNote}>
          ログインした企業のデータで対話しています。
        </p>
        {started ? <Link href="/pr-compass">新しい会話を始める</Link> : null}
        <Link href={companySelectPath}>別の企業に切り替える</Link>
      </div>
    </aside>
  )
}
