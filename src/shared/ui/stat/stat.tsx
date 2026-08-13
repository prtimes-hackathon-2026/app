import { type ReactNode } from 'react'
import { Icon, type IconName } from '../icon/icon'
import styles from './stat.module.css'

type StatGridProps = {
  children: ReactNode
}

/** 数値タイルを並べる格子。列数は幅に応じて自動で折り返す */
export function StatGrid({ children }: StatGridProps) {
  return <div className={styles.grid}>{children}</div>
}

type StatTileProps = {
  label: string
  value: ReactNode
  unit?: string
  note?: string
  icon?: IconName
}

/** 「直近 1 か月間のデータ」のような数値 1 つ分の表示 */
export function StatTile({ label, value, unit, note, icon }: StatTileProps) {
  return (
    <div className={styles.tile}>
      <div className={styles.label}>
        {icon && <Icon name={icon} size={15} />}
        {label}
      </div>
      <div className={styles.value}>
        {value}
        {unit && <span className={styles.unit}>{unit}</span>}
      </div>
      {note && <div className={styles.note}>{note}</div>}
    </div>
  )
}
