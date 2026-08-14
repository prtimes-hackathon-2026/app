import { NextResponse, type NextRequest } from 'next/server'

import { prCompassFeature } from '@/feature/pr-compass'

export const runtime = 'nodejs'

/** 25MB。数十秒の発話なら十分に収まる */
const MAX_BYTES = 25 * 1024 * 1024

/**
 * 話しかけられた音声を文字にして返す。
 *
 * 返すのは聞き取った文だけで、分類は通常の会話 API 側で行う。
 * 音声だけ別の道を通ると、そこが数値の抜け道になる。
 */
export async function POST(req: NextRequest) {
  try {
    const buf = Buffer.from(await req.arrayBuffer())
    if (!buf.length) return NextResponse.json({ text: '' })
    if (buf.length > MAX_BYTES) {
      return NextResponse.json(
        { error: '音声が長すぎます。短く区切って話してください。' },
        { status: 413 },
      )
    }

    const text = await prCompassFeature.listen(
      buf,
      req.headers.get('content-type') ?? 'audio/webm',
    )
    return NextResponse.json({ text })
  } catch (e) {
    console.error('PR Compass stt error:', e)
    return NextResponse.json({ text: '' })
  }
}
