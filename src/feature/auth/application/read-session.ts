import type { Session } from '../domain/session'
import type { SessionTokenCodec } from '../domain/session-token'

/**
 * 手元のトークンからセッションを復元する。
 *
 * 「Cookie が無い」「壊れている」「期限が切れた」はどれも同じ null。
 * 呼ぶ側 (app 層) がこの 3 つを区別する必要はなく、区別しないほうが安全に倒れる。
 */

export type ReadSession = (token: string | undefined) => Promise<Session | null>

export function readSession(tokens: SessionTokenCodec): ReadSession {
  return async (token) => {
    if (token === undefined || token === '') return null
    return tokens.read(token)
  }
}
