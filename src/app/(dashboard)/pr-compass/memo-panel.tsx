import Link from 'next/link'

import type { TurnNumber } from '@/feature/pr-agent'
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
        認証がまだ無いことによる暫定措置であることを、利用者にも分かる形で出しておく
        (設計 §11(a))。認証が入ったらこの注記ごと消える。
      */}
      <div className={styles.memoFooter}>
        <p className={styles.memoNote}>
          デモ用の画面です。ログインの仕組みがまだ無いため、対象の企業を一覧から選ぶ形にしています。
        </p>
        {started ? <Link href="/pr-compass">別の企業で試す</Link> : null}
      </div>
    </aside>
  )
}
