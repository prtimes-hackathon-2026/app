import { type ReactNode } from 'react'
import styles from './page-header.module.css'

type PageHeaderProps = {
  title: ReactNode
  description?: ReactNode
  /** 右端に置くページ単位の操作 */
  actions?: ReactNode
}

/** ページ見出し。全ページがこれを使うことで h1 の見た目と余白が揃う */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className={styles.header}>
      <div>
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  )
}
