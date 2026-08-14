import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { prCompassFeature } from '@/feature/pr-compass'
import { loginPath } from '@/shared/auth'

import { CompanyPicker } from './company-picker'
import { LoginPanel } from '../panel'
import { currentSession } from '../../session'

/**
 * ログインの 2 段目 — どの企業として使うかを選ぶ画面。
 *
 * ここで選んだ企業がセッションに載り、以降の画面はその企業のデータしか見せない。
 * 一覧は PR羅針盤 の対象と同じ「配信が止まっている企業」で、
 * 認証の窓口をこの一覧に限ることで、任意の企業 ID で入られないようにしている。
 *
 * パスワードを通していなければ 1 段目へ戻す。すでにログイン済みの人がここに来た場合は
 * 企業の選び直しとして扱う (合言葉を知っている以上、入り直しを求める意味がない)。
 */

export const metadata: Metadata = {
  title: '企業の選択',
}

export default async function Page() {
  const session = await currentSession()
  if (session === null) redirect(loginPath)

  const companies = await prCompassFeature.findStoppedCompanies()

  return (
    <LoginPanel
      title="企業を選ぶ"
      description="選んだ企業として管理画面を使います。PR羅針盤 の対話もこの企業のデータで始まります。"
      wide
    >
      <CompanyPicker companies={companies} />
    </LoginPanel>
  )
}
