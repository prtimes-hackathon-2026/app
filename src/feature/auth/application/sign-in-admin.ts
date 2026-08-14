import { expiresIn, type IssuedSession, type Session } from '../domain/session'
import type { SessionTokenCodec } from '../domain/session-token'

/** 管理者用の合言葉を通した選択セッションから、管理者セッションを発行する。 */
export type SignInAdminDeps = {
  readonly tokens: SessionTokenCodec
  readonly ttlSeconds: number
}

export type SignInAdmin = (
  current: Session | null,
) => Promise<IssuedSession | null>

export function signInAdmin(deps: SignInAdminDeps): SignInAdmin {
  return async (current) => {
    if (current?.stage !== 'password' || !current.adminAllowed) return null

    const session = {
      stage: 'admin',
      expiresAt: expiresIn(deps.ttlSeconds, new Date()),
    } as const
    return { session, token: await deps.tokens.issue(session) }
  }
}
