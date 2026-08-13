import { zValidator } from '@hono/zod-validator'
import {
  greetRequestSchema,
  type ApiError,
  type GreetResponse,
  type HealthResponse,
} from '@repo/shared'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { logger } from 'hono/logger'

/**
 * ルートはメソッドチェーンで組み立てる。
 * こうしないと `AppType` に型が積み上がらず、フロント側の RPC 補完が効かなくなる。
 */
export const app = new Hono()
  .use(logger())
  // dev では Vite の proxy 経由で同一オリジンになるため CORS は不要だが、
  // フロントを別オリジンに配信する構成でもそのまま動くようにしておく。
  .use(
    '/api/*',
    cors({
      origin: (process.env.WEB_ORIGIN ?? 'http://localhost:5173').split(','),
      credentials: true,
    }),
  )
  .get('/api/health', (c) => {
    return c.json({
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
    } satisfies HealthResponse)
  })
  .post('/api/greet', zValidator('json', greetRequestSchema), (c) => {
    const { name } = c.req.valid('json')
    return c.json({ message: `Hello, ${name}!` } satisfies GreetResponse)
  })

app.onError((err, c) => {
  const status = err instanceof HTTPException ? err.status : 500
  if (status >= 500) console.error(err)

  const message = status >= 500 ? 'Internal Server Error' : err.message
  return c.json({ error: { message } } satisfies ApiError, status)
})

app.notFound((c) => c.json({ error: { message: 'Not Found' } } satisfies ApiError, 404))

/** フロントエンドが `hc<AppType>()` に渡す、ルート定義から導出された型。 */
export type AppType = typeof app
