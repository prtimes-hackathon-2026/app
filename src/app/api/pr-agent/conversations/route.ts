import { NextResponse } from 'next/server'
import { z } from 'zod'

import { prAgentFeature } from '@/feature/pr-agent'

import { errorResponse, readJson } from '../http'

/**
 * 会話を開始してターン 0 を返す。
 *
 * Server Actions ではなく Route Handler にしてあるのは設計 §9 のとおり。
 * POST は常に非キャッシュなので `dynamic` は書かない。
 * `runtime` も書かない (このバージョンでは Edge Runtime ごと非推奨で、既定の nodejs でよい)。
 */

const bodySchema = z.object({
  // PR TIMES 側の企業 ID。認証が入るまでは画面 (デモ用の企業選択) から渡ってくる
  companyId: z.int().positive(),
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

  try {
    const started = await prAgentFeature.start(parsed.data.companyId)
    return NextResponse.json(started, { status: 201 })
  } catch (cause) {
    // 対象の企業が引けない・DB が落ちている等はここに来る。詳細は応答に出さない
    console.error('会話の開始に失敗しました', cause)
    return errorResponse(500, '会話を開始できませんでした')
  }
}
