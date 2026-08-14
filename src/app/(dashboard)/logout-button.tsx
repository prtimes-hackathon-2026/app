'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { loginPath } from '@/shared/auth'
import { Button } from '@/shared/ui'

/**
 * ログアウト。
 *
 * Cookie を消せるのはサーバだけなので、窓口を 1 回叩いてから画面を戻す。
 * 失敗しても伝える場所が無いヘッダーなので、どちらにせよログイン画面へ送る
 * (Cookie が残っていれば、その先で改めてログイン済みとして扱われる)。
 */
export function LogoutButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function logout() {
    if (isPending) return

    startTransition(async () => {
      try {
        await fetch('/api/auth/session', { method: 'DELETE' })
      } catch {
        // 通信できなくても、手元の画面はログイン画面に戻す
      }
      router.push(loginPath)
      router.refresh()
    })
  }

  return (
    <Button size="sm" onClick={logout} disabled={isPending}>
      ログアウト
    </Button>
  )
}
