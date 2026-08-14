'use client'

import { useActionState, useState } from 'react'

import type { SalesFlowCase, SalesFlowReason } from '@/feature/sales-flow-cases'
import { Button, Card, CardBody, CardHeader } from '@/shared/ui'

import {
  saveSalesFlowCaseAction,
  toggleSalesFlowCaseAction,
  type SaveSalesFlowCaseState,
} from './actions'
import styles from './page.module.css'

const initialSaveState: SaveSalesFlowCaseState = {
  status: 'idle',
  message: '',
}

export function SalesFlowCaseManager({
  cases,
  reasonOptions,
}: {
  cases: readonly SalesFlowCase[]
  reasonOptions: readonly { value: SalesFlowReason; label: string }[]
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formVersion, setFormVersion] = useState(0)
  const [state, formAction, pending] = useActionState(
    saveSalesFlowCaseAction,
    initialSaveState,
  )

  const editing = cases.find((item) => item.id === editingId) ?? null
  const savedAt = state.status === 'success' ? (state.submittedAt ?? 0) : 0
  const formKey = `${editing?.id ?? 'new'}:${formVersion}:${savedAt}`

  return (
    <div className={styles.layout}>
      <Card tone="outlined" className={styles.editorCard}>
        <CardHeader
          title={editing ? '事例を編集' : '新しい事例を登録'}
          actions={
            editing ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingId(null)
                  setFormVersion((current) => current + 1)
                }}
              >
                新規登録に戻す
              </Button>
            ) : undefined
          }
        />
        <CardBody>
          <form key={formKey} action={formAction} className={styles.form}>
            <input type="hidden" name="id" value={editing?.id ?? ''} />

            <label className={styles.field}>
              <span>事例名</span>
              <input
                name="title"
                required
                maxLength={80}
                defaultValue={editing?.title ?? ''}
                placeholder="例：反応がなかった企業への再提案"
              />
            </label>

            <div className={styles.row}>
              <label className={styles.field}>
                <span>適用する停止理由</span>
                <select name="reason" defaultValue={editing?.reason ?? 'any'}>
                  {reasonOptions.map((reason) => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span>優先度</span>
                <input
                  name="priority"
                  type="number"
                  min={1}
                  max={100}
                  required
                  defaultValue={editing?.priority ?? 50}
                />
                <small>数字が大きい事例を優先します。</small>
              </label>
            </div>

            <label className={styles.field}>
              <span>想定する状況</span>
              <textarea
                name="situation"
                required
                maxLength={600}
                rows={3}
                defaultValue={editing?.situation ?? ''}
                placeholder="例：1本配信したがPVや問い合わせにつながらず、担当者が効果を疑っている"
              />
            </label>

            <label className={styles.field}>
              <span>営業フロー</span>
              <textarea
                name="steps"
                required
                maxLength={2000}
                rows={6}
                defaultValue={editing?.steps.join('\n') ?? ''}
                placeholder={
                  '1行に1ステップ入力\n相手の観測を否定せず確認する\n同条件の実測値を1つだけ示す\n次に試せる打ち手を確認する'
                }
              />
              <small>1行を1ステップとして、最大8件まで保存します。</small>
            </label>

            <label className={styles.field}>
              <span>話し方の例（任意）</span>
              <textarea
                name="talkExample"
                maxLength={1200}
                rows={4}
                defaultValue={editing?.talkExample ?? ''}
                placeholder="例：反応がなかったという判断は自然です。まず、同じ条件の企業がどこで手応えを得たかだけ確認してもよいですか。"
              />
            </label>

            <label className={styles.field}>
              <span>このフローで目指す状態</span>
              <textarea
                name="desiredOutcome"
                required
                maxLength={400}
                rows={2}
                defaultValue={editing?.desiredOutcome ?? ''}
                placeholder="例：継続を押し付けず、次に判断するための材料を1つ増やす"
              />
            </label>

            <label className={styles.checkbox}>
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={editing?.enabled ?? true}
              />
              保存後すぐに会話へ適用する
            </label>

            {state.status !== 'idle' ? (
              <p
                className={
                  state.status === 'error' ? styles.error : styles.success
                }
                role="status"
              >
                {state.message}
              </p>
            ) : null}

            <div className={styles.formActions}>
              <Button type="submit" variant="accent" disabled={pending}>
                {pending ? '保存中…' : editing ? '変更を保存' : '事例を登録'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <section className={styles.list} aria-labelledby="case-list-title">
        <div className={styles.listHeading}>
          <div>
            <h2 id="case-list-title">登録済みの事例</h2>
            <p>有効な事例から、停止理由と優先度が合う1件を使います。</p>
          </div>
          <span className={styles.count}>{cases.length}件</span>
        </div>

        {cases.length === 0 ? (
          <Card tone="outlined">
            <CardBody standalone>
              <p className={styles.empty}>
                事例はまだありません。左のフォームから最初の1件を登録してください。
              </p>
            </CardBody>
          </Card>
        ) : (
          cases.map((item) => (
            <Card key={item.id} tone="outlined">
              <CardHeader
                title={item.title}
                actions={
                  <span
                    className={item.enabled ? styles.active : styles.inactive}
                  >
                    {item.enabled ? '適用中' : '停止中'}
                  </span>
                }
              />
              <CardBody>
                <div className={styles.meta}>
                  <span>
                    {reasonOptions.find(
                      (reason) => reason.value === item.reason,
                    )?.label ?? item.reason}
                  </span>
                  <span>優先度 {item.priority}</span>
                </div>
                <p className={styles.situation}>{item.situation}</p>
                <ol className={styles.steps}>
                  {item.steps.map((step, index) => (
                    <li key={`${item.id}:${index}`}>
                      <span>{index + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
                <div className={styles.caseActions}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingId(item.id)}
                  >
                    編集
                  </Button>
                  <form action={toggleSalesFlowCaseAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <input
                      type="hidden"
                      name="enabled"
                      value={String(!item.enabled)}
                    />
                    <Button size="sm" variant="ghost" type="submit">
                      {item.enabled ? '適用を停止' : '適用を再開'}
                    </Button>
                  </form>
                </div>
              </CardBody>
            </Card>
          ))
        )}
      </section>
    </div>
  )
}
