import { type ComponentProps } from 'react'
import { cx } from '../cx'
import { Icon, type IconName } from '../icon/icon'
import styles from './icon-button.module.css'

type IconButtonProps = Omit<ComponentProps<'button'>, 'children'> & {
  icon: IconName
  /** アイコンだけでは意味が伝わらないので必須。読み上げとツールチップに使う */
  label: string
  size?: 'sm' | 'md' | 'lg'
  iconSize?: number
  muted?: boolean
}

/** アイコンだけの操作 (閉じる・開閉・通知など) を 1 か所にまとめたもの */
export function IconButton({
  icon,
  label,
  size = 'md',
  iconSize = 18,
  muted,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        styles.base,
        styles[size],
        muted && styles.muted,
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={iconSize} />
    </button>
  )
}
