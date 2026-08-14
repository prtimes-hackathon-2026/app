import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { isAdmin } from '@/feature/auth'
import { prCompassFeature } from '@/feature/pr-compass'
import { adminPath, loginPath } from '@/shared/auth'

import { CompanyPicker } from './company-picker'
import { LoginPanel } from '../panel'
import { currentSession } from '../../session'

/**
 * ログインの 2 段目 — 企業または管理者のどちらとして使うかを選ぶ画面。
 *
 * 企業を選ぶと企業がセッションに載り、以降の画面はその企業のデータしか見せない。
 * 管理者用の合言葉を通した場合だけ、企業一覧の先頭に管理者を表示する。
 * 一覧は 目的設計 の対象と同じ「配信が止まっている企業」で、
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
  if (isAdmin(session)) redirect(adminPath)
  if (session === null) redirect(loginPath)

  const companies = await prCompassFeature.findStoppedCompanies()

  return (
    <LoginPanel
      title="企業を選ぶ"
      description="ログイン先を選んでください。企業を選ぶと、目的設計の対話もその企業のデータで始まります。"
      wide
    >
      <CompanyPicker
        companies={companies}
        canSelectAdmin={session.stage === 'password' && session.adminAllowed}
      />
    </LoginPanel>
  )
}
