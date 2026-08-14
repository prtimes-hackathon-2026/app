import { NextResponse, type NextRequest } from 'next/server'

import {
  parseConversationState,
  prCompassFeature,
  type ChatMessage,
} from '@/feature/pr-compass'

export const runtime = 'nodejs'

/**
 * 広報伴走エージェント。
 *
 * 会話の進み方は feature 側の状態機械が決めており、ここは受け渡しだけを行う。
 * 進行度は画面が state として持ち回るので、ここでは壊れていないかだけを見る。
 *
 * 数値はすべて統計 DB の集計結果で、LLM が作った数字は一つも載らない。
 * LLM は「自由入力を分岐に落とす」「下書きを言い換える」ためだけに使う。
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      messages?: ChatMessage[]
      memo?: string
      companyId?: number
      state?: unknown
    }

    // 対象企業。画面から渡されなければ既定値を使う
    const companyId =
      Number(body.companyId) ||
      Number(process.env.PR_COMPASS_COMPANY_ID) ||
      17170

    const result = await prCompassFeature.advanceConversation({
      companyId,
      messages: (body.messages ?? []).filter(
        (m) => m.role === 'user' || m.role === 'assistant',
      ),
      memo: body.memo ?? '',
      // 壊れていれば null。会話は最初の診断から始まる
      state: parseConversationState(body.state),
    })

    return NextResponse.json(result)
  } catch (e) {
    console.error('PR Compass chat error:', e)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 },
    )
  }
}
