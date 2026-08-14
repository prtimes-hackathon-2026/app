/**
 * 簡易ログインのセッション。
 *
 * 利用者アカウントは無く、「合言葉を知っている人が、企業を 1 社選んで入る」だけの
 * 仕組みなので、セッションが持つのは次の 2 つだけ。
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

export type Session = PasswordSession | SignedInSession

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

export function expiresIn(seconds: number, now: Date): Date {
  return new Date(now.getTime() + seconds * 1000)
}
