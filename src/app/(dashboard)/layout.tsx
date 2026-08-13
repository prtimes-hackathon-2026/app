import { appShellConfig } from '@/shared/app-config'
import { AppShell } from '@/shared/ui'

/**
 * 管理画面の共通レイアウト。
 * このルートグループに置いたページはすべてヘッダーとサイドバーを共有し、
 * パンくずも navigation の定義から自動で入る。
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppShell {...appShellConfig}>{children}</AppShell>
}
