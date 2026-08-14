import { NextResponse } from 'next/server'
import { z } from 'zod'

import { authFeature } from '@/feature/auth'
import { prMetricsFeature } from '@/feature/pr-metrics'

import { errorResponse, readJson } from '../../http'
import {
  clearSessionCookie,
  currentSession,
  writeSessionCookie,
} from '../../../session'

/**
 * ログインの 2 段目 (POST) と、ログアウト (DELETE)。
 *
 * 企業はここで確定し、以降その企業のデータしか見せない。
 * 選べるのは企業選択の画面に出ている企業だけに限る。ここを本文の企業 ID で
 * そのまま通してしまうと、任意の企業の内部データを引けた設計 §11(a) の状態に戻る。
 */

const bodySchema = z.object({
  // 0 を弾かないのは、模擬データの企業が ID 0 のため (DB 無しでも一通り動かせるようにする)。
  // 実在する企業かどうかは、下で一覧と突き合わせて確かめる
  companyId: z.int().nonnegative(),
})

export async function POST(request: Request) {
  const body = await readJson(request)
  if (!body.ok) {
    return errorResponse(400, 'リクエストの本文を JSON として読めませんでした')
  }

  const parsed = bodySchema.safeParse(body.value)
  if (!parsed.success) {
    return errorResponse(400, '入力が不正です', z.treeifyError(parsed.error))
  }

  // 合言葉を通したセッションが無ければ、ここから先には進ませない
  const session = await currentSession()
  if (session === null) {
    return errorResponse(401, '先にパスワードを入力してください')
  }

  try {
    const companies = await prMetricsFeature.findStoppedCompanies()
    const company = companies.find(
      (candidate) => candidate.companyId === parsed.data.companyId,
    )
    if (company === undefined) {
      return errorResponse(400, 'この企業では始められません')
    }

    const issued = await authFeature.signIn(session, {
      id: company.companyId,
      name: company.companyName,
    })
    if (issued === null) {
      return errorResponse(401, '先にパスワードを入力してください')
    }

    await writeSessionCookie(issued)
    return new NextResponse(null, { status: 204 })
  } catch (cause) {
    // 企業の一覧が引けない (DB が落ちている等) はここに来る。詳細は応答に出さない
    console.error('ログインに失敗しました', cause)
    return errorResponse(500, 'ログインできませんでした')
  }
}

export async function DELETE() {
  await clearSessionCookie()
  return new NextResponse(null, { status: 204 })
}
