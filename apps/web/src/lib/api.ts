import type { AppType } from '@repo/api'
import { hc } from 'hono/client'

/**
 * 型付き API クライアント。
 *
 * `AppType` は `@repo/api` の**型だけ**を import している（`import type` なので実行時の依存はゼロ）。
 * バックエンドのルートを増やす / パスを変える / レスポンスの形を変えると、
 * ここを経由する呼び出し側がそのままコンパイルエラーになる。
 */
export const client = hc<AppType>(import.meta.env.VITE_API_BASE_URL ?? '/')
