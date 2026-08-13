import { z } from 'zod'

/**
 * サンプル: `POST /api/greet` のリクエストボディ。
 *
 * API 側は `zValidator('json', greetRequestSchema)` で実行時に検証し、
 * フロント側は `GreetRequest` として同じ型を使う。スキーマが唯一の情報源になる。
 */
export const greetRequestSchema = z.object({
  name: z.string().min(1).max(50),
})

export type GreetRequest = z.infer<typeof greetRequestSchema>

export interface GreetResponse {
  message: string
}

export interface HealthResponse {
  status: 'ok'
  uptimeSeconds: number
}

/** ハンドラが投げたエラーを `app.onError` が包んで返す共通の形。 */
export interface ApiError {
  error: {
    message: string
  }
}
