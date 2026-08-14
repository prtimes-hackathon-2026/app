import { isAdmin } from '@/feature/auth'
import { adminNavigation, appShellConfig } from '@/shared/app-config'
import { adminPath } from '@/shared/auth'
import { AppShell } from '@/shared/ui'

import { LogoutButton } from './logout-button'
import { requireAuthenticated } from '../session'

/**
 * 管理画面の共通レイアウト。
 * このルートグループに置いたページはすべてヘッダーとサイドバーを共有し、
 * パンくずも navigation の定義から自動で入る。
 *
 * ログインの確認もここが持つ。配下のページが増えても守り漏れが起きないうえ、
 * ヘッダーに出す名乗りをセッションから作れる。
 * 企業のデータを直接読むページ (目的設計) は、それに頼らず自分でも確かめる。
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireAuthenticated()
  const admin = isAdmin(session)
  const shellConfig = admin
    ? {
        ...appShellConfig,
        brand: { ...appShellConfig.brand, href: adminPath },
        navigation: adminNavigation,
        actions: [],
        support: undefined,
        showChat: false,
      }
    : appShellConfig

  return (
    <AppShell
      {...shellConfig}
      // 既定の名乗り (app-config の見本) を、ログインした企業で上書きする
      account={
        admin
          ? {
              name: '管理者',
              meta: '営業フロー管理',
              href: adminPath,
            }
          : {
              name: session.company.name ?? `企業ID ${session.company.id}`,
              meta: `企業ID：${session.company.id}`,
              href: '/settings/company',
            }
      }
      accountAction={<LogoutButton />}
    >
      {children}
    </AppShell>
  )
}
