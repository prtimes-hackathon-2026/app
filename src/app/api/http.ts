import { NextResponse } from 'next/server'

/**
 * Route Handler で応答の形を揃えるための小さなヘルパー。
 *
 * `error` は画面がそのまま利用者に見せる文言なので、例外のメッセージは載せない。
 * 詳細 (`details`) は入力の不備を直すための情報だけを入れる。
 */

export type ErrorBody = {
  readonly error: string
  readonly details?: unknown
}

export function errorResponse(
  status: number,
  error: string,
  details?: unknown,
): NextResponse<ErrorBody> {
  const body: ErrorBody = details === undefined ? { error } : { error, details }
  return NextResponse.json(body, { status })
}

/**
 * 本文の JSON を読む。
 *
 * 空の本文と壊れた JSON はどちらも同じ「読めない」なので、
 * 例外を投げずにここで吸収して 400 に倒せるようにする。
 */
export async function readJson(
  request: Request,
): Promise<
  { readonly ok: true; readonly value: unknown } | { readonly ok: false }
> {
  try {
    return { ok: true, value: await request.json() }
  } catch {
    return { ok: false }
  }
}
