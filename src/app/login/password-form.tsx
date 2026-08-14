'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, type FormEvent } from 'react'

import { companySelectPath } from '@/shared/auth'
import { Button } from '@/shared/ui'

import { LoginError } from './panel'
import styles from './login.module.css'

/**
 * パスワードの送信。
 *
 * 照合はサーバでしか行わない。ここは入力を Route Handler に渡し、
 * 返ってきた結果で画面を進めるだけで、正解のパスワードには一切触れない。
 *
 * 成功したときに `router.refresh()` も呼ぶのは、遷移先の描画が Cookie に依存するため。
 * 手元に残った古い描画を捨てさせ、サーバに描き直させる。
 */
export function PasswordForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isPending || password === '') return
    setError(null)

    startTransition(async () => {
      let response: Response
      try {
        response = await fetch('/api/auth/password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        })
      } catch {
        setError('通信に失敗しました。もう一度お試しください。')
        return
      }

      if (!response.ok) {
        setError(
          response.status === 401
            ? 'パスワードが違います。'
            : 'ログインできませんでした。',
        )
        return
      }

      router.push(companySelectPath)
      router.refresh()
    })
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      {error === null ? null : <LoginError message={error} />}

      <label className={styles.label}>
        パスワード
        <input
          className={styles.input}
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          disabled={isPending}
          onChange={(event) => setPassword(event.target.value)}
          // 入力欄が 1 つしかない画面なので、開いたらすぐ打てるようにする
          autoFocus
        />
      </label>

      <Button
        type="submit"
        variant="accent"
        block
        disabled={isPending || password === ''}
      >
        {isPending ? '確認しています…' : '次へ'}
      </Button>
    </form>
  )
}
