import { appShellConfig } from '@/shared/app-config'
import { AppShell } from '@/shared/ui'

import { LogoutButton } from './logout-button'
import { requireSignedIn } from '../session'

/**
 * 管理画面の共通レイアウト。
 * このルートグループに置いたページはすべてヘッダーとサイドバーを共有し、
 * パンくずも navigation の定義から自動で入る。
 *
 * ログインの確認もここが持つ。配下のページが増えても守り漏れが起きないうえ、
 * ヘッダーに出す名乗りをセッションから作れる。
 * 企業のデータを直接読むページ (PR羅針盤) は、それに頼らず自分でも確かめる。
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireSignedIn()

  return (
    <AppShell
      {...appShellConfig}
      // 既定の名乗り (app-config の見本) を、ログインした企業で上書きする
      account={{
        name: session.company.name ?? `企業ID ${session.company.id}`,
        meta: `企業ID：${session.company.id}`,
        href: '/settings/company',
      }}
      accountAction={<LogoutButton />}
    >
      {children}
    </AppShell>
  )
}
