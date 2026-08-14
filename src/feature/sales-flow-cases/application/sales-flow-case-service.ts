import { z } from 'zod'

import { settingsFeature } from '@/feature/settings'

import {
  salesFlowReasons,
  type SalesFlowCase,
  type SalesFlowCaseInput,
  type SalesFlowReason,
} from '../domain/sales-flow-case'

const SETTING_KEY = 'pr-compass.sales-flow-cases.v1'

const storedCaseSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(80),
  reason: z.enum(salesFlowReasons),
  situation: z.string().trim().min(1).max(600),
  steps: z.array(z.string().trim().min(1).max(240)).min(1).max(8),
  talkExample: z.string().trim().max(1200),
  desiredOutcome: z.string().trim().min(1).max(400),
  priority: z.number().int().min(1).max(100),
  enabled: z.boolean(),
  updatedAt: z.iso.datetime(),
})

const storedCasesSchema = z.array(storedCaseSchema).max(100)

function sortCases(cases: readonly SalesFlowCase[]): SalesFlowCase[] {
  return [...cases].sort(
    (left, right) =>
      Number(right.enabled) - Number(left.enabled) ||
      right.priority - left.priority ||
      right.updatedAt.localeCompare(left.updatedAt),
  )
}

async function readCases(): Promise<SalesFlowCase[]> {
  const setting = await settingsFeature.getSetting(SETTING_KEY)
  if (!setting) return []

  const parsed = storedCasesSchema.safeParse(setting.value)
  if (!parsed.success) {
    console.error(
      '[sales-flow-cases] invalid stored setting',
      z.prettifyError(parsed.error),
    )
    return []
  }
  return sortCases(parsed.data)
}

async function writeCases(cases: readonly SalesFlowCase[]) {
  const parsed = storedCasesSchema.parse(cases)
  await settingsFeature.updateSetting(SETTING_KEY, parsed)
  return sortCases(parsed)
}

export const salesFlowCaseInputSchema = storedCaseSchema
  .omit({ id: true, updatedAt: true })
  .extend({ id: z.string().uuid().optional() })

export async function listSalesFlowCases(): Promise<readonly SalesFlowCase[]> {
  return readCases()
}

export async function saveSalesFlowCase(
  value: SalesFlowCaseInput,
): Promise<SalesFlowCase> {
  const input = salesFlowCaseInputSchema.parse(value)
  const cases = await readCases()
  const now = new Date().toISOString()
  const saved: SalesFlowCase = {
    ...input,
    id: input.id ?? crypto.randomUUID(),
    updatedAt: now,
  }
  const index = cases.findIndex((item) => item.id === saved.id)
  const next = [...cases]
  if (index < 0) next.push(saved)
  else next[index] = saved
  await writeCases(next)
  return saved
}

export async function setSalesFlowCaseEnabled(
  id: string,
  enabled: boolean,
): Promise<SalesFlowCase> {
  const parsedId = z.string().uuid().parse(id)
  const cases = await readCases()
  const found = cases.find((item) => item.id === parsedId)
  if (!found) throw new Error('営業フロー事例が見つかりません')

  const updated = {
    ...found,
    enabled,
    updatedAt: new Date().toISOString(),
  }
  await writeCases(cases.map((item) => (item.id === parsedId ? updated : item)))
  return updated
}

export async function findSalesFlowCase(
  reason: Exclude<SalesFlowReason, 'any'>,
): Promise<SalesFlowCase | null> {
  const cases = await readCases()
  return (
    cases
      .filter(
        (item) =>
          item.enabled && (item.reason === reason || item.reason === 'any'),
      )
      .sort(
        (left, right) =>
          right.priority - left.priority ||
          Number(right.reason === reason) - Number(left.reason === reason) ||
          right.updatedAt.localeCompare(left.updatedAt),
      )[0] ?? null
  )
}
