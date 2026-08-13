/**
 * 画面部品の公開 API。
 * 使う側は必ず `@/shared/ui` から import し、内部のファイル構成には依存しない。
 */
export { cx } from './cx'

export { Icon, iconNames, type IconName } from './icon/icon'

export {
  Button,
  LinkButton,
  type ButtonSize,
  type ButtonVariant,
} from './button/button'
export { IconButton } from './button/icon-button'

export { Card, CardBody, CardHeader, type CardTone } from './card/card'
export { CollapsibleCard } from './card/collapsible-card'

export { Stack } from './layout/stack'

export { Breadcrumb, type Crumb } from './page/breadcrumb'
export { PageHeader } from './page/page-header'

export { StatGrid, StatTile } from './stat/stat'

export { AppShell, type AppShellProps } from './app-shell/app-shell'
export { AppHeader } from './app-shell/app-header'
export { ChatFab } from './app-shell/chat-fab'
export { SideNav } from './app-shell/side-nav'
export {
  findNavTrail,
  isPathActive,
  toCrumbs,
  type AccountInfo,
  type BrandInfo,
  type HeaderAction,
  type NavItem,
  type SupportInfo,
} from './app-shell/navigation'
