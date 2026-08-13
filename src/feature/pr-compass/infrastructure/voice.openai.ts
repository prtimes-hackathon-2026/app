import 'server-only'

import { env } from '@/shared/env'

/**
 * 声は台本を読むだけで、文章を作らない。
 * だから LLM が数値を言い間違える経路がここには無い。
 *
 * 音が出せなくても会話は成立する。TTS が落ちたら null を返し、
 * 画面は音なしでそのまま進む（音は付加であって前提ではない）。
 */

const TTS_MODEL = 'gpt-4o-mini-tts'
const STT_MODEL = 'gpt-4o-mini-transcribe'

/** 営業だが売り込まない。数字の前で一拍おかせる */
const TONE = `落ち着いた日本語の営業担当として読む。
早口にしない。数字の前でわずかに間をおく。語尾を上げない。
売り込まない。事実を淡々と、相手の側に立って伝える。`

const apiKey = () => env().OPENAI_API_KEY ?? ''

export const voiceReady = () => Boolean(apiKey())

/**
 * 同じ文は二度作らない。会話の初手は毎回同じ文になるので、
 * ここが効くと「押してから喋り出すまで」の間が消える。
 */
const cache = new Map<string, Buffer>()
const CACHE_MAX = 60

/** 読み上げる文 → mp3。作れなければ null */
export async function speak(
  text: string,
  voice = 'shimmer',
): Promise<Buffer | null> {
  const key = apiKey()
  if (!key || !text.trim()) return null

  const ck = `${voice}\n${text}`
  const hit = cache.get(ck)
  if (hit) return hit

  try {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: TTS_MODEL,
        voice,
        input: text,
        instructions: TONE,
        response_format: 'mp3',
      }),
    })
    if (!res.ok) {
      console.error('[tts]', res.status, (await res.text()).slice(0, 200))
      return null
    }
    const buf = Buffer.from(await res.arrayBuffer())
    if (cache.size >= CACHE_MAX) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) cache.delete(oldest)
    }
    cache.set(ck, buf)
    return buf
  } catch (e) {
    console.error('[tts]', e)
    return null
  }
}

// OpenAI 側は拡張子で形式を判定するので mime と必ず合わせる。
// ここがずれると 400 が返る（Chrome は webm、Safari は mp4）
const EXTENSIONS: readonly (readonly [string, string])[] = [
  ['webm', 'webm'],
  ['ogg', 'ogg'],
  ['mpeg', 'mp3'],
  ['mp3', 'mp3'],
  ['mp4', 'mp4'],
  ['m4a', 'm4a'],
  ['aac', 'm4a'],
  ['wav', 'wav'],
  ['flac', 'flac'],
]

/** 話した音声 → テキスト。聞き取れなければ空文字 */
export async function listen(
  audio: Buffer,
  mime = 'audio/webm',
): Promise<string> {
  const key = apiKey()
  if (!key || !audio.length) return ''

  const lower = mime.toLowerCase()
  const ext = EXTENSIONS.find(([k]) => lower.includes(k))?.[1] ?? 'webm'

  try {
    const form = new FormData()
    form.append(
      'file',
      new Blob([new Uint8Array(audio)], { type: mime }),
      `speech.${ext}`,
    )
    form.append('model', STT_MODEL)
    form.append('language', 'ja')

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    })
    if (!res.ok) {
      console.error('[stt]', res.status, (await res.text()).slice(0, 200))
      return ''
    }
    const data = (await res.json()) as { text?: string }
    return String(data.text ?? '').trim()
  } catch (e) {
    console.error('[stt]', e)
    return ''
  }
}

/**
 * 画面の文章を、耳で聞いて分かる形に直す。
 * 目で読む前提の表記をそのまま読ませると聞き取れない。
 */
export function forSpeech(text: string): string {
  return text
    .replace(/[■●▲]/g, '')
    .replace(/PV/g, 'ピーブイ')
    .replace(/(\d)\s*[〜～]\s*(\d)/g, '$1から$2')
    .replace(/【】/g, 'すみつきカッコ')
    .replace(/[「」『』]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 全文を読み上げると1分の独白になるので、頭の2文だけにする。
 * 詳細は画面で読んでもらう。音声は掴みだけを担当する。
 */
export function toScript(content: string, maxSentences = 2): string {
  const paragraphs = content
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    // 最後の問いかけは残したいので、それ以外の本文から取る
    .slice(0, maxSentences)
  return forSpeech(paragraphs.join(' '))
}
