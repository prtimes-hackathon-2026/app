/**
 * 簡易ログインのセッション。
 *
 * 利用者アカウントは無く、企業利用者か管理者の共有パスワードで入る簡易的な
 * 仕組み。企業利用者は企業を 1 社選び、管理者は管理機能だけを使う。
 *
 * - どこまで進んだか (合言葉だけ通ったのか、企業まで確定したのか)
 * - 確定した企業 (PR TIMES 側の企業 ID)
 *
 * 段階を型で分けているのは、合言葉を通しただけの状態を「ログイン済み」と
 * 取り違えないようにするため。企業のデータを読む画面は SignedInSession しか受け取らない。
 */

/** ログイン後に画面が名乗る企業 */
export type SessionCompany = {
  readonly id: number
  readonly name: string | null
}

/** 合言葉だけ通った状態。まだどの企業のデータも見せない */
export type PasswordSession = {
  readonly stage: 'password'
  readonly expiresAt: Date
}

/** 企業まで確定した状態。ここまで来て初めてログイン済みとして扱う */
export type SignedInSession = {
  readonly stage: 'signed-in'
  readonly company: SessionCompany
  readonly expiresAt: Date
}

/** 管理機能だけを使える状態。企業の情報は持たない */
export type AdminSession = {
  readonly stage: 'admin'
  readonly expiresAt: Date
}

export type AuthenticatedSession = SignedInSession | AdminSession
export type Session = PasswordSession | AuthenticatedSession

/** 発行したてのセッションと、それを載せた署名済みトークン */
export type IssuedSession = {
  readonly session: Session
  readonly token: string
}

export function isSignedIn(
  session: Session | null,
): session is SignedInSession {
  return session !== null && session.stage === 'signed-in'
}

export function isAdmin(session: Session | null): session is AdminSession {
  return session !== null && session.stage === 'admin'
}

export function isAuthenticated(
  session: Session | null,
): session is AuthenticatedSession {
  return isSignedIn(session) || isAdmin(session)
}

export function expiresIn(seconds: number, now: Date): Date {
  return new Date(now.getTime() + seconds * 1000)
}
