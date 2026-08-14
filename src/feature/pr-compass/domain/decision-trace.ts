import type { Step } from './conversation'

/**
 * 外部に出してよい判断記録。
 * モデルの思考過程ではなく、適用したルール・参照事実・検証結果だけを残す。
 */
export type DecisionTrace = {
  step: Step
  skill: {
    id: string
    version: number
    score: number
    minimumScore: number
  } | null
  salesFlowCase?: {
    id: string
    title: string
    priority: number
  }
  matchedRules: readonly string[]
  evidence: readonly { label: string; value: string }[]
  decision: string
  nextRoute: string
  validations: readonly {
    hook: string
    status: 'passed' | 'failed' | 'skipped'
    details?: string
  }[]
}
