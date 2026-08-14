import {
  expiresIn,
  type IssuedSession,
  type Session,
  type SessionCompany,
} from '../domain/session'
import type { SessionTokenCodec } from '../domain/session-token'

/**
 * ログインの 2 段目 — 企業を確定してログインを成立させる。
 *
 * 合言葉を通したセッション (1 段目) が無ければ何も発行しない。
 * すでにログイン済みのセッションも受け付けるので、入り直さずに企業を選び直せる。
 *
 * どの企業を選べるかは app 層が決める。ここは「渡された企業で発行してよいか」
 * だけを見る。
 */

export type SignInDeps = {
  readonly tokens: SessionTokenCodec
  readonly ttlSeconds: number
}

export type SignIn = (
  current: Session | null,
  company: SessionCompany,
) => Promise<IssuedSession | null>

export function signIn(deps: SignInDeps): SignIn {
  return async (current, company) => {
    if (current === null || current.stage === 'admin') return null

    const session = {
      stage: 'signed-in',
      company,
      expiresAt: expiresIn(deps.ttlSeconds, new Date()),
    } as const
    return { session, token: await deps.tokens.issue(session) }
  }
}
