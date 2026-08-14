'use server'

import { revalidatePath } from 'next/cache'

import {
  salesFlowCaseInputSchema,
  salesFlowCasesFeature,
  type SalesFlowCaseInput,
} from '@/feature/sales-flow-cases'

import { requireSignedIn } from '../../../session'

const PAGE_PATH = '/settings/sales-flow-cases'

export type SaveSalesFlowCaseState = {
  readonly status: 'idle' | 'success' | 'error'
  readonly message: string
  readonly savedId?: string
  readonly submittedAt?: number
}

const value = (formData: FormData, key: string) =>
  String(formData.get(key) ?? '').trim()

export async function saveSalesFlowCaseAction(
  _state: SaveSalesFlowCaseState,
  formData: FormData,
): Promise<SaveSalesFlowCaseState> {
  await requireSignedIn()

  const input: SalesFlowCaseInput = {
    ...(value(formData, 'id') ? { id: value(formData, 'id') } : {}),
    title: value(formData, 'title'),
    reason: value(formData, 'reason') as SalesFlowCaseInput['reason'],
    situation: value(formData, 'situation'),
    steps: value(formData, 'steps')
      .split('\n')
      .map((item) => item.trim().replace(/^[-・]\s*/, ''))
      .filter(Boolean),
    talkExample: value(formData, 'talkExample'),
    desiredOutcome: value(formData, 'desiredOutcome'),
    priority: Number(value(formData, 'priority')),
    enabled: formData.get('enabled') === 'on',
  }

  const parsed = salesFlowCaseInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      status: 'error',
      message:
        '入力内容を確認してください。必須項目、文字数、優先度を見直してください。',
      submittedAt: Date.now(),
    }
  }

  try {
    const saved = await salesFlowCasesFeature.saveSalesFlowCase(parsed.data)
    revalidatePath(PAGE_PATH)
    return {
      status: 'success',
      message: '営業フロー事例を保存しました。',
      savedId: saved.id,
      submittedAt: Date.now(),
    }
  } catch (error) {
    console.error('[sales-flow-cases] save failed', error)
    return {
      status: 'error',
      message: '保存できませんでした。時間をおいてもう一度お試しください。',
      submittedAt: Date.now(),
    }
  }
}

export async function toggleSalesFlowCaseAction(formData: FormData) {
  await requireSignedIn()
  const id = value(formData, 'id')
  const enabled = value(formData, 'enabled') === 'true'
  try {
    await salesFlowCasesFeature.setSalesFlowCaseEnabled(id, enabled)
    revalidatePath(PAGE_PATH)
  } catch (error) {
    console.error('[sales-flow-cases] toggle failed', error)
    throw new Error('営業フロー事例の状態を変更できませんでした')
  }
}
