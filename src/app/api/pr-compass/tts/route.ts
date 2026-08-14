import { NextResponse, type NextRequest } from 'next/server'

import { prCompassFeature } from '@/feature/pr-compass'

export const runtime = 'nodejs'

/**
 * 読み上げる文を音声にする。
 *
 * 渡せるのは会話で既に確定した本文だけで、ここで文章は作らない。
 * 声が出せないときは 204 を返し、画面は音なしでそのまま進む。
 */
export async function POST(req: NextRequest) {
  try {
    const { text } = (await req.json()) as { text?: string }
    const audio = await prCompassFeature.speak(String(text ?? ''))
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
