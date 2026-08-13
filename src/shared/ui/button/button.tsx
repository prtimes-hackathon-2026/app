import Link from 'next/link'
import { type ComponentProps, type ReactNode } from 'react'
import { cx } from '../cx'
import { Icon, type IconName } from '../icon/icon'
import styles from './button.module.css'

export type ButtonVariant = 'outline' | 'accent' | 'solid' | 'ghost'
export type ButtonSize = 'sm' | 'md'

type ButtonBase = {
  variant?: ButtonVariant
  size?: ButtonSize
  /** ラベルの前に置くアイコン */
  icon?: IconName
  /** ラベルの後ろに置くアイコン */
  iconEnd?: IconName
  block?: boolean
  className?: string
  children?: ReactNode
}

function buttonClassName({
  variant = 'outline',
  size = 'md',
  block,
  className,
}: ButtonBase) {
  return cx(
    styles.base,
    styles[variant],
    styles[size],
    block && styles.block,
    className,
  )
}

function ButtonInner({ icon, iconEnd, children }: ButtonBase) {
  const iconSize = 16
  return (
    <>
      {icon && <Icon name={icon} size={iconSize} />}
      {children}
      {iconEnd && <Icon name={iconEnd} size={iconSize} />}
    </>
  )
}

type ButtonProps = ButtonBase & Omit<ComponentProps<'button'>, keyof ButtonBase>

/** 押すためのボタン。遷移させたいときは LinkButton を使う */
export function Button({
  variant,
  size,
  icon,
  iconEnd,
  block,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName({ variant, size, block, className })}
      {...rest}
    >
      <ButtonInner icon={icon} iconEnd={iconEnd}>
        {children}
      </ButtonInner>
    </button>
  )
}

type LinkButtonProps = ButtonBase &
  Omit<ComponentProps<typeof Link>, keyof ButtonBase>

/** 見た目はボタン、実体はリンク。ボタン風の遷移導線はすべてこれで統一する */
export function LinkButton({
  variant,
  size,
  icon,
  iconEnd,
  block,
  className,
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <Link
      className={buttonClassName({ variant, size, block, className })}
      {...rest}
    >
      <ButtonInner icon={icon} iconEnd={iconEnd}>
        {children}
      </ButtonInner>
    </Link>
  )
}
