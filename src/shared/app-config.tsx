import {
  PrTimesLogo,
  type AccountInfo,
  type BrandInfo,
  type HeaderAction,
  type NavItem,
  type SupportInfo,
} from '@/shared/ui'

/**
 * 画面の骨組みに流し込む値をここ 1 か所に集める。
 *
 * `@/shared/ui` 側は「どんな項目が来ても並べられる」ことだけを担当し、
 * 実際に何を並べるかはこのファイルが決める。
 * メニューを増やす・ロゴを変える・窓口を差し替えるといった変更はここだけで完結する。
 */

export const brand: BrandInfo = {
  name: 'PR TIMES',
  href: '/dashboard',
  logo: <PrTimesLogo />,
}

export const headerActions: HeaderAction[] = [
  {
    label: 'メディアリスト新規作成',
    href: '/media-lists/new',
    variant: 'outline',
  },
  {
    label: 'プレスリリース新規作成',
    href: '/press-releases/new',
    variant: 'accent',
  },
]

export const support: SupportInfo = {
  label: 'サポートデスクはこちら',
  tel: '03-0000-0000',
  formLabel: '問い合わせフォーム',
  formHref: '/settings/support',
}

export const account: AccountInfo = {
  name: '株式会社サンプル',
  meta: '企業ID：00000',
  href: '/settings/company',
}

export const navigation: NavItem[] = [
  {
    label: 'ダッシュボード',
    href: '/dashboard',
    icon: 'dashboard',
  },
  {
    label: '目的設計',
    href: '/pr-compass',
    icon: 'chat',
  },
  {
    label: 'プレスリリース',
    href: '/press-releases',
    icon: 'document',
    children: [
      { label: '一覧', href: '/press-releases' },
      { label: '新規作成', href: '/press-releases/new' },
      { label: '下書き', href: '/press-releases/drafts' },
      { label: '配信予約', href: '/press-releases/scheduled' },
    ],
  },
  {
    label: 'メディアリスト',
    href: '/media-lists',
    icon: 'list',
    children: [
      { label: '一覧', href: '/media-lists' },
      { label: '新規作成', href: '/media-lists/new' },
      { label: 'インポート', href: '/media-lists/import' },
    ],
  },
  {
    label: 'ストーリー',
    href: '/stories',
    icon: 'book',
    children: [
      { label: '一覧', href: '/stories' },
      { label: '下書き', href: '/stories/drafts' },
    ],
  },
  {
    label: '分析データ',
    href: '/analytics',
    icon: 'chart',
    children: [
      { label: 'プレスリリース分析', href: '/analytics/press-releases' },
      { label: '企業ページ分析', href: '/analytics/company' },
    ],
  },
  {
    label: 'Webクリッピング',
    href: '/web-clipping',
    icon: 'clip',
    children: [
      { label: 'クリップ一覧', href: '/web-clipping' },
      { label: 'クリップ調査', href: '/web-clipping/surveys' },
    ],
  },
  {
    label: '企業ページ',
    href: '/company',
    icon: 'building',
    children: [
      { label: '企業情報', href: '/company' },
      { label: '公開設定', href: '/company/visibility' },
    ],
  },
  {
    label: '設定',
    href: '/settings',
    icon: 'settings',
    children: [
      { label: 'アカウント', href: '/settings/account' },
      { label: '企業情報', href: '/settings/company' },
      { label: '営業フロー事例', href: '/settings/sales-flow-cases' },
      { label: '通知', href: '/settings/notifications' },
      { label: 'お問い合わせ', href: '/settings/support' },
    ],
  },
]

export const appShellConfig = {
  brand,
  navigation,
  actions: headerActions,
  support,
  account,
}
