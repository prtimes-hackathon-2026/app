import Link from 'next/link'
import { IconButton } from '../button/icon-button'
import { LinkButton } from '../button/button'
import { Icon } from '../icon/icon'
import styles from './app-header.module.css'
import {
  type AccountInfo,
  type BrandInfo,
  type HeaderAction,
  type SupportInfo,
} from './navigation'

type AppHeaderProps = {
  brand: BrandInfo
  actions?: HeaderAction[]
  support?: SupportInfo
  account?: AccountInfo
}

/**
 * 画面最上部の帯。
 * 並ぶ内容はすべて props なので、ロゴ・導線・窓口・アカウントを差し替えるだけで別サービスにも使える。
 */
export function AppHeader({
  brand,
  actions,
  support,
  account,
}: AppHeaderProps) {
  return (
    <header className={styles.header}>
      <Link href={brand.href} className={styles.brand}>
        {brand.name}
      </Link>

      {actions && actions.length > 0 && (
        <div className={styles.actions}>
          {actions.map((action) => (
            <LinkButton
              key={action.href}
              href={action.href}
              variant={action.variant}
              icon={action.icon}
            >
              {action.label}
            </LinkButton>
          ))}
        </div>
      )}

      <div className={styles.right}>
        {support && (
          <div className={styles.support}>
            <span className={styles.supportLabel}>{support.label}</span>
            <div className={styles.supportBody}>
              <a href={`tel:${support.tel}`} className={styles.tel}>
                <Icon name="phone" size={20} />
                {support.tel}
              </a>
              <LinkButton
                href={support.formHref}
                size="sm"
                icon="form"
                variant="outline"
              >
                {support.formLabel}
              </LinkButton>
            </div>
          </div>
        )}

        <IconButton icon="bell" label="お知らせ" size="lg" iconSize={22} />

        {account && (
          <Link href={account.href} className={styles.account}>
            <span className={styles.accountText}>
              <span className={styles.accountName}>{account.name}</span>
              {account.meta && (
                <span className={styles.accountMeta}>{account.meta}</span>
              )}
            </span>
            <Icon name="account" size={30} className={styles.avatar} />
          </Link>
        )}
      </div>
    </header>
  )
}
