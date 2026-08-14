import 'server-only'

import { z } from 'zod'

import type { Session } from '../domain/session'
import type { SessionTokenCodec } from '../domain/session-token'

/**
 * セッションを HMAC-SHA256 で署名した文字列にする実装。
 *
 * 形は `<base64url(ペイロード)>.<base64url(署名)>` で、JWT の最小形と同じ考え方。
 * ライブラリを足していないのは、載せるのが「段階」と「企業 ID」の 2 つだけで、
 * 鍵の回転も発行元の検証も要らないため。暗号そのものは Web Crypto に任せる。
 *
 * 中身は暗号化していない (誰でも読める)。企業 ID と企業名しか入れないのはこのため。
 * 保証するのは「勝手に書き換えられない」ことと「期限を過ぎたら通らない」ことだけ。
 */

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** `exp` は epoch ミリ秒。JSON を通っても Date に化けないので数値のまま持つ */
const payloadSchema = z.discriminatedUnion('stage', [
  z.object({
    stage: z.literal('password'),
    exp: z.int().positive(),
  }),
  z.object({
    stage: z.literal('signed-in'),
    exp: z.int().positive(),
    // 0 を弾かないのは、模擬データの企業が ID 0 のため (DB 無しでも一通り動かせるようにする)
    companyId: z.int().nonnegative(),
    companyName: z.string().nullable(),
  }),
  z.object({
    stage: z.literal('admin'),
    exp: z.int().positive(),
  }),
])

type Payload = z.infer<typeof payloadSchema>

export function hmacSessionTokenCodec(secret: string): SessionTokenCodec {
  // 鍵の取り込みは 1 回で済ませる。失敗したら次の呼び出しでやり直せるよう遅延させる
  let cachedKey: Promise<CryptoKey> | undefined
  function key(): Promise<CryptoKey> {
    cachedKey ??= crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    )
    return cachedKey
  }

  return {
    async issue(session) {
      const body = toBase64Url(
        encoder.encode(JSON.stringify(toPayload(session))),
      )
      const signature = await crypto.subtle.sign(
        'HMAC',
        await key(),
        encoder.encode(body),
      )
      return `${body}.${toBase64Url(new Uint8Array(signature))}`
    },

    async read(token) {
      const [body, signature, ...rest] = token.split('.')
      if (body === undefined || signature === undefined || rest.length > 0) {
        return null
      }

      const signatureBytes = fromBase64Url(signature)
      if (signatureBytes === null) return null

      // 署名の比較は Web Crypto に任せる (実行時間が中身で変わらない)
      const valid = await crypto.subtle.verify(
        'HMAC',
        await key(),
        signatureBytes,
        encoder.encode(body),
      )
      if (!valid) return null

      const bodyBytes = fromBase64Url(body)
      if (bodyBytes === null) return null

      const parsed = payloadSchema.safeParse(
        parseJson(decoder.decode(bodyBytes)),
      )
      if (!parsed.success) return null
      if (parsed.data.exp <= Date.now()) return null

      return toSession(parsed.data)
    },
  }
}

function toPayload(session: Session): Payload {
  const exp = session.expiresAt.getTime()
  if (session.stage === 'password') return { stage: 'password', exp }
  if (session.stage === 'admin') return { stage: 'admin', exp }
  return {
    stage: 'signed-in',
    exp,
    companyId: session.company.id,
    companyName: session.company.name,
  }
}

function toSession(payload: Payload): Session {
  const expiresAt = new Date(payload.exp)
  if (payload.stage === 'password') return { stage: 'password', expiresAt }
  if (payload.stage === 'admin') return { stage: 'admin', expiresAt }
  return {
    stage: 'signed-in',
    company: { id: payload.companyId, name: payload.companyName },
    expiresAt,
  }
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

/**
 * base64url は Cookie に載せられる文字だけで済むので使う。
 * `Buffer` を使わないのは、Node.js 以外の実行環境に置かれても同じように動かすため。
 */
function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

/** Web Crypto に渡すので、`ArrayBuffer` を持つことが型に出る形で作る */
function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/'))
    const bytes = new Uint8Array(new ArrayBuffer(binary.length))
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}
