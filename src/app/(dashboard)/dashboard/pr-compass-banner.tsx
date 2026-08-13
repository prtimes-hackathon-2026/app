import Link from 'next/link'
import { Icon } from '@/shared/ui'
import styles from './pr-compass-banner.module.css'

/**
 * 長期間（1年以上）プレスリリースを配信していない企業向けに
 * 広報目的の再確認を促すバナー。
 * ダッシュボードの最上部に表示する。
 */
export function PrCompassBanner() {
  return (
    <div className={styles.banner} role="region" aria-label="PR羅針盤のご案内">
      <div className={styles.bannerIcon}>
        <Icon name="chat" size={20} />
      </div>

      <div className={styles.bannerBody}>
        <p className={styles.bannerTitle}>
          お久しぶりです。広報活動を再開しませんか？
        </p>
        <p className={styles.bannerDesc}>
          前回のプレスリリース配信から1年以上が経過しています。
          PR TIMESを使う目的を改めて整理することで、次の配信がぐっと効果的になります。
        </p>
      </div>

      <Link href="/pr-compass" className={styles.bannerAction}>
        目的を確認する
        <Icon name="chevronRight" size={14} />
      </Link>
    </div>
  )
}
