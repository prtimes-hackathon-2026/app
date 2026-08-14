import { NextResponse, type NextRequest } from 'next/server'

import { prCompassFeature, type ChatMessage } from '@/feature/pr-compass'

import { signedInSession } from '../../../session'

export const runtime = 'nodejs'

/**
 * 広報伴走エージェント。
 *
 * 会話の進み方は feature 側の状態機械が決めており、ここは受け渡しだけを行う。
 * 画面は `{ role, content }` しか送ってこないので、進行度は履歴から復元する。
 *
 * 数値はすべて統計 DB の集計結果で、LLM が作った数字は一つも載らない。
 * LLM は「自由入力を分岐に落とす」「下書きを言い換える」ためだけに使う。
 */
export async function POST(req: NextRequest) {
  try {
    const session = await signedInSession()
    if (session === null) {
      return NextResponse.json(
        { error: 'ログインして企業を選んでください' },
        { status: 401 },
      )
    }

    const body = (await req.json()) as {
      messages?: ChatMessage[]
      memo?: string
    }

    const result = await prCompassFeature.advanceConversation({
      // 企業はリクエスト本文や固定値ではなく、ログイン時に選んだセッションから確定する。
      companyId: session.company.id,
      messages: (body.messages ?? []).filter(
        (m) => m.role === 'user' || m.role === 'assistant',
      ),
      memo: body.memo ?? '',
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
