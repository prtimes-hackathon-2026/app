import { NextResponse } from 'next/server'

import { prAgentFeature } from '@/feature/pr-agent'

import { errorResponse } from '../../http'
import { signedInSession } from '../../../session'

/**
 * 会話を開始してターン 0 を返す。
 *
 * 対象の企業はセッションが持つので、本文は受け取らない。
 * 以前は画面 (デモ用の企業選択) から企業 ID が渡ってきていたが、
 * それだと任意の企業の内部データを引けてしまう (設計 §11(a))。
 *
 * Server Actions ではなく Route Handler にしてあるのは設計 §9 のとおり。
 * POST は常に非キャッシュなので `dynamic` は書かない。
 * `runtime` も書かない (このバージョンでは Edge Runtime ごと非推奨で、既定の nodejs でよい)。
 */

export async function POST() {
  const session = await signedInSession()
  if (session === null) {
    return errorResponse(401, 'ログインしてください')
  }

  try {
    const started = await prAgentFeature.start(session.company.id)
    if (started === null) {
      return errorResponse(404, 'この企業のデータが見つかりませんでした')
    }
    return NextResponse.json(started, { status: 201 })
  } catch (cause) {
    // 対象の企業が引けない・DB が落ちている等はここに来る。詳細は応答に出さない
    console.error('会話の開始に失敗しました', cause)
    return errorResponse(500, '会話を開始できませんでした')
  }
}
