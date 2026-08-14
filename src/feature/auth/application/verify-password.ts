import { matchesPassword } from '../domain/password'
import type { SessionTokenCodec } from '../domain/session-token'
import { expiresIn, type IssuedSession } from '../domain/session'

/**
 * ログインの 1 段目 — 合言葉を照合する。
 *
 * 通っても、まだどの企業のデータも見せない。企業を選ぶ画面に進むための
 * 短命なセッションを発行するだけ。2 段目 (signIn) はこのセッションを要求するので、
 * 企業選択の POST を直接叩いて合言葉を飛ばすことはできない。
 */

export type VerifyPasswordDeps = {
  readonly tokens: SessionTokenCodec
  readonly password: string
  /** 企業を選び終えるまでの猶予。長く持たせる意味がないので短くする */
  readonly ttlSeconds: number
}

export type VerifyPassword = (input: string) => Promise<IssuedSession | null>

export function verifyPassword(deps: VerifyPasswordDeps): VerifyPassword {
  return async (input) => {
    if (!matchesPassword(input, deps.password)) return null

    const session = {
      stage: 'password',
      expiresAt: expiresIn(deps.ttlSeconds, new Date()),
    } as const
    return { session, token: await deps.tokens.issue(session) }
  }
}
