import { matchesPassword } from '../domain/password'
import type { SessionTokenCodec } from '../domain/session-token'
import { expiresIn, type IssuedSession } from '../domain/session'

/**
 * ログインの 1 段目 — 合言葉を照合する。
 *
 * 通っても、まだ企業データや管理機能は見せない。ログイン先を選ぶ画面に進むための
 * 短命なセッションを発行するだけ。管理者用の合言葉だった場合は、署名対象の
 * `adminAllowed` を立て、次の画面でだけ管理者の選択肢を出せるようにする。
 */

export type VerifyPasswordDeps = {
  readonly tokens: SessionTokenCodec
  readonly password: string
  readonly adminPassword: string
  /** 企業を選び終えるまでの猶予。長く持たせる意味がないので短くする */
  readonly ttlSeconds: number
}

export type VerifyPassword = (input: string) => Promise<IssuedSession | null>

export function verifyPassword(deps: VerifyPasswordDeps): VerifyPassword {
  return async (input) => {
    // 片方が一致しても両方を照合し、どちらを試したかで処理時間が極端に変わらないようにする
    const companyAllowed = matchesPassword(input, deps.password)
    const adminAllowed = matchesPassword(input, deps.adminPassword)
    if (!companyAllowed && !adminAllowed) return null

    const session = {
      stage: 'password',
      adminAllowed,
      expiresAt: expiresIn(deps.ttlSeconds, new Date()),
    } as const
    return { session, token: await deps.tokens.issue(session) }
  }
}
