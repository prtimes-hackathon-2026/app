import { matchesPassword } from '../domain/password'
import { expiresIn, type IssuedSession } from '../domain/session'
import type { SessionTokenCodec } from '../domain/session-token'

/** 管理者用の共有パスワードを照合し、管理者セッションを直接発行する。 */
export type SignInAdminDeps = {
  readonly tokens: SessionTokenCodec
  readonly password: string
  readonly ttlSeconds: number
}

export type SignInAdmin = (input: string) => Promise<IssuedSession | null>

export function signInAdmin(deps: SignInAdminDeps): SignInAdmin {
  return async (input) => {
    if (!matchesPassword(input, deps.password)) return null

    const session = {
      stage: 'admin',
      expiresAt: expiresIn(deps.ttlSeconds, new Date()),
    } as const
    return { session, token: await deps.tokens.issue(session) }
  }
}
