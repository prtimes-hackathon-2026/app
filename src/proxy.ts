import { NextResponse, type NextRequest } from 'next/server'

import { loginPath, sessionCookieName } from '@/shared/auth'

/**
 * 入口でのふるい分け。ログインしていない要求をログイン画面へ送る。
 *
 * このバージョンの Next.js では `middleware.ts` は非推奨で、`proxy.ts` が正
 * (機能は同じで、名前と export 名だけが変わった)。既定で Node.js ランタイムで動くので
 * `runtime` の export は書かない (書くとエラーになる)。
 *
 * ここでやるのは Cookie が「有るか」の確認だけで、署名の検証はしない。
 * 公式ガイドが proxy を optimistic check に留めるよう明記しているのと、
 * ここを通らない経路 (Server Function への直接 POST など) があるため。
 * 本物かどうかの判定は、企業のデータを読む直前に app 層 (`requireSignedIn`) が行う。
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(sessionCookieName)) return NextResponse.next()

  // API は画面遷移ではないので、ログイン画面の HTML を返しても読めない。401 で返す
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'ログインしてください' }, { status: 401 })
  }

  return NextResponse.redirect(new URL(loginPath, request.url))
}

/**
 * ふるいから外すもの。
 *
 * - `_next/*` と favicon: 画面の描画に要る資産。止めると何も表示できなくなる
 * - `login`: ログイン画面そのもの (2 段目の `/login/company` も含む)
 * - `api/auth`: ログイン・ログアウトの窓口
 * - `api/health`: 死活監視。ログインを要求すると監視が落ちる
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login|api/auth|api/health).*)',
  ],
}
