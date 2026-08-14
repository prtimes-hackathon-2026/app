import { NextResponse } from 'next/server'
import { z } from 'zod'

import { authFeature } from '@/feature/auth'

import { errorResponse, readJson } from '../../http'
import { writeSessionCookie } from '../../../session'

/**
 * ログインの 1 段目 — 合言葉を受け取る。
 *
 * 通っても、この時点ではまだどの企業のデータも見せない。
 * 企業を選ぶ画面に進むための短命なセッションを Cookie に載せて返すだけ。
 *
 * Server Actions ではなく Route Handler なのは設計 §9 のとおり。
 * Cookie を書けるのは Route Handler と Server Function だけなので、
 * ログインの入り口はどのみちここに集まる。
 */

const bodySchema = z.object({
  password: z.string().min(1),
  role: z.enum(['company', 'admin']).default('company'),
})

export async function POST(request: Request) {
  const body = await readJson(request)
  if (!body.ok) {
    return errorResponse(400, 'リクエストの本文を JSON として読めませんでした')
  }

  const parsed = bodySchema.safeParse(body.value)
  if (!parsed.success) {
    return errorResponse(400, 'パスワードを入力してください')
  }

  const issued =
    parsed.data.role === 'admin'
      ? await authFeature.signInAdmin(parsed.data.password)
      : await authFeature.verifyPassword(parsed.data.password)
  // 合っていない理由は返さない (長さや惜しさが分かる形にしない)
  if (issued === null) {
    return errorResponse(401, 'パスワードが違います')
  }

  await writeSessionCookie(issued)
  return new NextResponse(null, { status: 204 })
}
