'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, type FormEvent } from 'react'

import { adminPath, companySelectPath } from '@/shared/auth'
import { Button } from '@/shared/ui'

import { LoginError } from './panel'
import styles from './login.module.css'

/**
 * パスワードの送信。
 *
 * 照合はサーバでしか行わない。ここはログイン種別と入力を Route Handler に渡し、
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
  const [role, setRole] = useState<'company' | 'admin'>('company')

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
          body: JSON.stringify({ password, role }),
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

      router.push(role === 'admin' ? adminPath : companySelectPath)
      router.refresh()
    })
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      {error === null ? null : <LoginError message={error} />}

      <fieldset className={styles.roleFieldset} disabled={isPending}>
        <legend className={styles.labelText}>ログイン種別</legend>
        <div className={styles.roleOptions}>
          <label
            className={styles.roleOption}
            data-selected={role === 'company'}
          >
            <input
              type="radio"
              name="role"
              value="company"
              checked={role === 'company'}
              onChange={() => setRole('company')}
            />
            企業利用者
          </label>
          <label className={styles.roleOption} data-selected={role === 'admin'}>
            <input
              type="radio"
              name="role"
              value="admin"
              checked={role === 'admin'}
              onChange={() => setRole('admin')}
            />
            管理者
          </label>
        </div>
      </fieldset>

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
        {isPending
          ? '確認しています…'
          : role === 'admin'
            ? '管理画面へログイン'
            : '次へ'}
      </Button>
    </form>
  )
}
