export const salesFlowReasons = [
  'any',
  'no_topic',
  'no_time',
  'no_effect',
  'handover',
  'none',
] as const

export type SalesFlowReason = (typeof salesFlowReasons)[number]

export const salesFlowReasonLabels: Record<SalesFlowReason, string> = {
  any: 'すべての停止理由',
  no_topic: '発信するネタがない',
  no_time: '時間・人手が足りない',
  no_effect: '効果を感じられなかった',
  handover: '担当変更・引き継ぎ不足',
  none: '明確な理由はない',
}

export type SalesFlowCase = {
  readonly id: string
  readonly title: string
  readonly reason: SalesFlowReason
  readonly situation: string
  readonly steps: readonly string[]
  readonly talkExample: string
  readonly desiredOutcome: string
  readonly priority: number
  readonly enabled: boolean
  readonly updatedAt: string
}

export type SalesFlowCaseInput = Omit<SalesFlowCase, 'id' | 'updatedAt'> & {
  readonly id?: string
}
