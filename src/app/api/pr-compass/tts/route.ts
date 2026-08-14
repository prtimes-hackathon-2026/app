import { NextResponse, type NextRequest } from 'next/server'

import {
  prCompassFeature,
  type VoiceContextMessage,
} from '@/feature/pr-compass'

export const runtime = 'nodejs'

/**
 * 表示済みのチャットについて話す音声を作る。
 *
 * 詳細本文をそのまま読むのではなく、同じ画面を見ている前提の短い発話にする。
 * 声が出せないときは 204 を返し、画面は音なしでそのまま進む。
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      text?: string
      messages?: VoiceContextMessage[]
    }
    const text = String(body.text ?? '').slice(0, 6_000)
    const messages = Array.isArray(body.messages) ? body.messages : []
    const commentary = await prCompassFeature.composeVoiceCommentary(
      messages,
      text,
    )
    const audio = await prCompassFeature.speak(commentary)
    if (!audio) return new NextResponse(null, { status: 204 })

    return new NextResponse(new Uint8Array(audio), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('PR Compass tts error:', e)
    return new NextResponse(null, { status: 204 })
  }
}
