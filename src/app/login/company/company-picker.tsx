'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import type { StoppedCompany } from '@/feature/pr-compass'
import { adminPath, afterLoginPath } from '@/shared/auth'
import { blank, formatDate, formatNumber } from '@/shared/format'
import { Button } from '@/shared/ui'

import { LoginError } from '../panel'
import styles from '../login.module.css'

/**
 * 企業を 1 社選んでログインを成立させる。
 *
 * 送るのは企業 ID だけで、その ID が選べるものかどうかは Route Handler が
 * もう一度この一覧と突き合わせて確かめる。ここで弾いても、直接叩かれれば意味がないため。
 */
export function CompanyPicker({
  companies,
  canSelectAdmin,
}: {
  companies: readonly StoppedCompany[]
  canSelectAdmin: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function signIn(
    body:
      | { readonly role: 'company'; readonly companyId: number }
      | { readonly role: 'admin' },
    destination: string,
  ) {
    // 二重送信の防止
    if (isPending) return
    setError(null)

    startTransition(async () => {
      let response: Response
      try {
        response = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } catch {
        setError('通信に失敗しました。もう一度お試しください。')
        return
      }

      if (!response.ok) {
        setError(
          response.status === 401
            ? 'ログインの有効期限が切れました。パスワードからやり直してください。'
            : 'ログインできませんでした。',
        )
        return
      }

      router.push(destination)
      router.refresh()
    })
  }

  if (companies.length === 0 && !canSelectAdmin) {
    return (
      <p className={styles.note}>
        選べる企業が見つかりませんでした。データベースの接続を確認してください。
      </p>
    )
  }

  return (
    <>
      {error === null ? null : <LoginError message={error} />}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">ログイン先</th>
              <th scope="col">業種</th>
              <th scope="col" className={styles.num}>
                配信本数
              </th>
              <th scope="col" className={styles.num}>
                最後の配信
              </th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {canSelectAdmin && (
              <tr className={styles.adminRow}>
                <th scope="row">管理者</th>
                <td colSpan={3} className={styles.adminMeta}>
                  営業フロー事例を管理する
                </td>
                <td>
                  <Button
                    size="sm"
                    variant="accent"
                    iconEnd="chevronRight"
                    disabled={isPending}
                    onClick={() => signIn({ role: 'admin' }, adminPath)}
                  >
                    管理者でログイン
                  </Button>
                </td>
              </tr>
            )}
            {companies.map((company) => (
              <tr key={company.companyId}>
                <th scope="row">
                  {company.companyName ?? `ID ${company.companyId}`}
                </th>
                <td>{company.industryName ?? blank}</td>
                <td className={styles.num}>
                  {formatNumber(company.releases)}本
                </td>
                <td className={styles.num}>
                  {formatDate(company.lastReleasedAt)}
                </td>
                <td>
                  <Button
                    size="sm"
                    variant="accent"
                    iconEnd="chevronRight"
                    disabled={isPending}
                    onClick={() =>
                      signIn(
                        { role: 'company', companyId: company.companyId },
                        afterLoginPath,
                      )
                    }
                  >
                    この企業でログイン
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
