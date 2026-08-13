import { type ReactNode } from 'react'
import { cx } from '../cx'
import styles from './stack.module.css'

type StackProps = {
  /** 要素間の余白。トークンの間隔だけを選べるようにして値の散らばりを防ぐ */
  gap?: 2 | 3 | 4 | 6
  className?: string
  children: ReactNode
}

/** 縦方向に一定の余白で積むだけの器。カードの列など至るところで使う */
export function Stack({ gap = 4, className, children }: StackProps) {
  return (
    <div className={cx(styles.stack, styles[`gap${gap}`], className)}>
      {children}
    </div>
  )
}
