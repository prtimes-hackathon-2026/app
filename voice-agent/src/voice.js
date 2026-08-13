import 'dotenv/config'
import { INTERESTS } from './catalog.js'

const KEY = (process.env.OPENAI_API_KEY || '').trim()
const TTS_MODEL = process.env.TTS_MODEL || 'gpt-4o-mini-tts'
const STT_MODEL = process.env.STT_MODEL || 'gpt-4o-mini-transcribe'
const TEXT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
const VOICE = process.env.TTS_VOICE || 'shimmer'

export const VOICE_READY = Boolean(KEY)

/** 声のトーン。営業だが売り込まない。数字の前で一拍おかせる */
const TONE = `落ち着いた日本語の営業担当として読む。
早口にしない。数字の前でわずかに間をおく。語尾を上げない。
売り込まない。事実を淡々と、相手の側に立って伝える。`

/**
 * 同じ文は二度作らない。台本の1文目と締めの問いは毎回同じ文なので、
 * ここが効いて「クリックしてから喋り出すまで」の間が消える。
 */
const cache = new Map()
const CACHE_MAX = 60

/** テキスト → mp3。失敗したら null を返し、画面は音なしでそのまま動く */
export async function speak(text, { voice = VOICE, instructions = TONE } = {}) {
  if (!KEY || !String(text || '').trim()) return null

  const ck = `${voice}\n${text}`
  if (cache.has(ck)) return cache.get(ck)

  try {
    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: TTS_MODEL,
        voice,
        input: text,
        instructions,
        response_format: 'mp3',
      }),
    })
    if (!r.ok) {
      console.error('[tts]', r.status, (await r.text()).slice(0, 300))
      return null
    }
    const buf = Buffer.from(await r.arrayBuffer())
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value)
    cache.set(ck, buf)
    return buf
  } catch (e) {
    console.error('[tts]', e.message)
    return null
  }
}

// OpenAI側は拡張子で形式を見るので、mimeと必ず合わせる（ここがずれると400になる）
const EXT = [
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

/** 音声 → テキスト */
export async function listen(buf, mime = 'audio/webm') {
  if (!KEY || !buf?.length) return ''
  const m = String(mime).toLowerCase()
  const ext = (EXT.find(([k]) => m.includes(k)) || ['', 'webm'])[1]
  try {
    const form = new FormData()
    form.append('file', new Blob([buf], { type: mime }), `speech.${ext}`)
    form.append('model', STT_MODEL)
    form.append('language', 'ja')
    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}` },
      body: form,
    })
    if (!r.ok) {
      console.error('[stt]', r.status, (await r.text()).slice(0, 300))
      return ''
    }
    return String((await r.json()).text || '').trim()
  } catch (e) {
    console.error('[stt]', e.message)
    return ''
  }
}

const CLASSIFY = `ユーザーの発話を、次の4つのどれか1つに割り当てる。

${INTERESTS.map((i) => `${i.id}: ${i.label}`).join('\n')}

判断がつかない場合は topic。
出力は id をそのまま1語だけ。説明も記号も付けない。`

/**
 * 聞き取った自由発話を4択に落とす。
 * 「それはつまり○○ですね」と言い直させず、黙って分類する（設計方針）。
 */
export async function classify(text) {
  const ids = INTERESTS.map((i) => i.id)
  if (!KEY || !String(text || '').trim()) return 'topic'
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        temperature: 0,
        max_tokens: 5,
        messages: [
          { role: 'system', content: CLASSIFY },
          { role: 'user', content: String(text).slice(0, 500) },
        ],
      }),
    })
    if (!r.ok) return 'topic'
    const out = String(
      (await r.json()).choices?.[0]?.message?.content || '',
    ).trim()
    return ids.find((id) => out.includes(id)) || 'topic'
  } catch (e) {
    console.error('[classify]', e.message)
    return 'topic'
  }
}
