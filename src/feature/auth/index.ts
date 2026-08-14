import 'server-only'

import { authConfig } from '@/shared/env'

import { readSession } from './application/read-session'
import { signIn } from './application/sign-in'
import { signInAdmin } from './application/sign-in-admin'
import { verifyPassword } from './application/verify-password'
import type { Session, SessionCompany } from './domain/session'
import { hmacSessionTokenCodec } from './infrastructure/session-token.hmac'

export type {
  AdminSession,
  AuthenticatedSession,
  IssuedSession,
  Session,
  SessionCompany,
  SignedInSession,
} from './domain/session'
export { isAdmin, isAuthenticated, isSignedIn } from './domain/session'

/**
 * 簡易ログイン。
 *
 * 企業用と管理者用の合言葉を照合する簡易ログイン。企業利用者は企業を 1 社選び、
 * 管理者は管理機能だけを使う。利用者アカウントは持たず、セッションは署名した Cookie に載せる
 * (Cookie の出し入れは HTTP 境界なので app 層の仕事)。
 * 認証ライブラリを入れていない理由は README「簡易ログイン」を参照。
 *
 * 設計 §11(a) の「認証が入ったら app 層だけ差し替える」はこれで満たされる。
 * 企業 ID の出どころが画面の選択からセッションに変わっただけで、他の feature は
 * 今までどおり「確定した企業 ID」を受け取る。
 */

/** 合言葉を通してから企業を選び終えるまでの猶予 */
const passwordStageTtlSeconds = 10 * 60
/** ログイン後にそのまま使える時間。触っていなくても切れる */
const signedInTtlSeconds = 12 * 60 * 60

/**
 * 合成は最初に呼ばれた時点まで遅らせる。
 *
 * `authConfig()` は production で署名鍵が無ければ例外を投げる作りなので、
 * ここで即座に組み立てると、環境変数を持たない `next build` (CI) が落ちてしまう。
 * env の遅延評価と同じ理由で、実際にログインを扱う瞬間まで読まない。
 */
function build() {
  const config = authConfig()
  const tokens = hmacSessionTokenCodec(config.sessionSecret)

  return {
    verifyPassword: verifyPassword({
      tokens,
      password: config.password,
      ttlSeconds: passwordStageTtlSeconds,
    }),
    signIn: signIn({ tokens, ttlSeconds: signedInTtlSeconds }),
    signInAdmin: signInAdmin({
      tokens,
      password: config.adminPassword,
      ttlSeconds: signedInTtlSeconds,
    }),
    readSession: readSession(tokens),
  }
}

let cached: ReturnType<typeof build> | undefined

function feature(): ReturnType<typeof build> {
  cached ??= build()
  return cached
}

export const authFeature = {
  /** 1 段目: 合言葉を照合する。合っていなければ null */
  verifyPassword: (input: string) => feature().verifyPassword(input),
  /** 2 段目: 企業を確定してログインを成立させる。1 段目を通っていなければ null */
  signIn: (current: Session | null, company: SessionCompany) =>
    feature().signIn(current, company),
  /** 管理者の合言葉を照合し、企業を選ばず管理機能へ入る */
  signInAdmin: (input: string) => feature().signInAdmin(input),
  /** Cookie の中身からセッションを復元する。読めなければ null */
  readSession: (token: string | undefined) => feature().readSession(token),
} as const
