import 'server-only'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import {
  authFeature,
  isAdmin,
  isAuthenticated,
  isSignedIn,
  type AdminSession,
  type AuthenticatedSession,
  type IssuedSession,
  type Session,
  type SignedInSession,
} from '@/feature/auth'
import {
  adminPath,
  afterLoginPath,
  loginPath,
  sessionCookieName,
} from '@/shared/auth'

/**
 * セッションと Cookie の境界。
 *
 * 「署名されたセッションを Cookie に載せる / 取り出す」のは HTTP の話なので app 層に置く。
 * 画面と Route Handler はここだけを使い、Cookie の名前も属性も直接触らない。
 *
 * 書き込み (`set` / `delete`) は Route Handler からしか呼べない。
 * 描画を始めたあとに Cookie は送れないという HTTP の制約があるため、
 * ログインとログアウトはすべて `/api/auth/*` を叩く形にしてある。
 */

export async function currentSession(): Promise<Session | null> {
  const store = await cookies()
  return authFeature.readSession(store.get(sessionCookieName)?.value)
}

/**
 * ログイン済みであることを求める。そうでなければログイン画面へ送る。
 *
 * 入口 (`src/proxy.ts`) でも Cookie の有無を見ているが、あちらは素通りさせない
 * ためのふるいでしかない。企業のデータを読む前に、必ずここで本物か確かめる。
 */
export async function requireSignedIn(): Promise<SignedInSession> {
  const session = await currentSession()
  if (isAdmin(session)) redirect(adminPath)
  if (!isSignedIn(session)) redirect(loginPath)
  return session
}

/** 企業利用者または管理者としてログイン済みであることを求める。 */
export async function requireAuthenticated(): Promise<AuthenticatedSession> {
  const session = await currentSession()
  if (!isAuthenticated(session)) redirect(loginPath)
  return session
}

/** 管理者であることを求める。企業利用者は管理画面へ入れない。 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await currentSession()
  if (isAdmin(session)) return session
  if (isSignedIn(session)) redirect(afterLoginPath)
  redirect(loginPath)
}

/**
 * Route Handler 用。
 * ログイン画面の HTML を返しても API の呼び出し側は読めないので、
 * リダイレクトはせず「ログインしていない」を null で返し、401 は呼ぶ側が返す。
 */
export async function signedInSession(): Promise<SignedInSession | null> {
  const session = await currentSession()
  return isSignedIn(session) ? session : null
}

export async function writeSessionCookie(issued: IssuedSession): Promise<void> {
  const store = await cookies()
  store.set(sessionCookieName, issued.token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    // 開発は http で動かすので、production のときだけ https に限定する
    secure: process.env.NODE_ENV === 'production',
    // Cookie の寿命は、署名に載せた期限と必ず揃える
    expires: issued.session.expiresAt,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.delete(sessionCookieName)
}
