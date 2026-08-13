import { type ReactNode } from 'react'
import { type IconName } from '../icon/icon'
import { type Crumb } from '../page/breadcrumb'

export type NavItem = {
  label: string
  href: string
  icon?: IconName
  children?: NavItem[]
}

/** ヘッダー中央に並べる主要導線 */
export type HeaderAction = {
  label: string
  href: string
  variant?: 'outline' | 'accent' | 'solid'
  icon?: IconName
}

/** ヘッダー右側のサポート窓口 */
export type SupportInfo = {
  label: string
  tel: string
  formLabel: string
  formHref: string
}

/** ヘッダー右端のログイン中アカウント */
export type AccountInfo = {
  name: string
  /** 「企業ID：99125」のような補助表示 */
  meta?: string
  href: string
}

export type BrandInfo = {
  /** 読み上げと、ロゴを渡さないときの表示に使うサービス名 */
  name: string
  href: string
  /** ロゴマーク。渡すと name の代わりにこれを出す */
  logo?: ReactNode
}

/** 現在地の判定。完全一致か、配下のパスであれば true */
export function isPathActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * ナビゲーション定義から現在地までの道筋を取り出す。
 * パンくずと、サイドバーのどのメニューを開いておくかの両方がこれ 1 つで決まる。
 *
 * `parentHref` は再帰用。親と同じ URL を指す「一覧」のような項目は、
 * 配下のページ (/press-releases/new など) まで巻き取らないよう完全一致だけで判定する。
 */
export function findNavTrail(
  items: NavItem[],
  pathname: string,
  parentHref?: string,
): NavItem[] {
  for (const item of items) {
    const childTrail = item.children
      ? findNavTrail(item.children, pathname, item.href)
      : []

    if (childTrail.length > 0) return [item, ...childTrail]

    const matched =
      item.href === parentHref
        ? pathname === item.href
        : isPathActive(pathname, item.href)

    if (matched) return [item]
  }

  return []
}

/** 道筋をパンくずの形に直す。末尾は現在地なのでリンクにしない */
export function toCrumbs(trail: NavItem[]): Crumb[] {
  return trail.map((item, index) => ({
    label: item.label,
    href: index === trail.length - 1 ? undefined : item.href,
  }))
}
