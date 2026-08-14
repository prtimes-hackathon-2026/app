import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { isAdmin, isSignedIn } from '@/feature/auth'
import { adminPath, afterLoginPath, companySelectPath } from '@/shared/auth'

import { LoginPanel } from './panel'
import { PasswordForm } from './password-form'
import { currentSession } from '../session'

/**
 * ログインの 1 段目 — パスワードを入力する画面。
 *
 * 合言葉を 1 つ知っていれば入れる簡易的なログインで、利用者アカウントは無い。
 * 誰として入るか (どの企業か) は 2 段目で選ぶ。
 *
 * Cookie を読むので描画は毎回サーバで行われる (`dynamic` は書かない。設計 §9)。
 */

export const metadata: Metadata = {
  title: 'ログイン',
}

export default async function Page() {
  const session = await currentSession()
  // すでに入っている人をログイン画面に留めない。企業だけ未選択なら 2 段目へ送る
  if (isAdmin(session)) redirect(adminPath)
  if (isSignedIn(session)) redirect(afterLoginPath)
  if (session !== null) redirect(companySelectPath)

  return (
    <LoginPanel
      title="ログイン"
      description="パスワードを入力してください。次の画面で利用する企業を選びます。"
    >
      <PasswordForm />
    </LoginPanel>
  )
}
