import type { GreetResponse, HealthResponse } from '@repo/shared'
import { useEffect, useState } from 'react'
import { client } from './lib/api'

/**
 * 配線が通っているか確認するためだけの画面。
 * 実装を始めるときは中身を丸ごと差し替えてよい。
 */
export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [name, setName] = useState('world')
  const [greeting, setGreeting] = useState<GreetResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    client.api.health
      .$get()
      .then((res) => res.json())
      .then(setHealth)
      .catch(() => setError('API に接続できませんでした'))
  }, [])

  async function greet(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    // 引数の形も、返り値の型も AppType から導出される。
    const res = await client.api.greet.$post({ json: { name } })
    if (!res.ok) {
      setError(`リクエストが失敗しました (${res.status})`)
      return
    }
    setGreeting(await res.json())
  }

  return (
    <main>
      <h1>app</h1>

      <p>API: {health ? `${health.status} / uptime ${health.uptimeSeconds}s` : '接続中…'}</p>

      <form onSubmit={greet}>
        <input value={name} onChange={(e) => setName(e.target.value)} aria-label="name" />
        <button type="submit">greet</button>
      </form>

      {greeting && <p>{greeting.message}</p>}
      {error && <p role="alert">{error}</p>}
    </main>
  )
}
