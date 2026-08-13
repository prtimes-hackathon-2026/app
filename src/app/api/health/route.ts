import { NextResponse } from 'next/server'

/**
 * コンテナ / ロードバランサ向けの liveness チェック。
 * プロセスが生きているかだけを見るので、意図的に DB へは触れない。
 * DB を含む readiness が必要になったら feature 側にユースケースを足して、
 * ここからはその公開 API を呼ぶだけにする。
 */
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({ status: 'ok' })
}
