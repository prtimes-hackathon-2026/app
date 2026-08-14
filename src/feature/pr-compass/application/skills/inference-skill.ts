import type { ConversationState, Reason, Step } from '../../domain/conversation'
import type { DecisionTrace } from '../../domain/decision-trace'
import type { Insight } from '../../domain/insight'
import type { NarrationPolicy } from '../../domain/language'
import type { Draft } from '../compose-draft'

type ActivationRuleBase = {
  id: string
  description: string
  weight: number
}

export type SkillActivationRule =
  | (ActivationRuleBase & {
      field: 'step'
      equals: Step
    })
  | (ActivationRuleBase & {
      field: 'reason'
      equals: Reason
    })

/**
 * 推論工程のうち、運用者が差し替えたい部分だけを設定として切り出す。
 * 数値の算出や最終検証は Skill の外に残し、Skill から無効化できないようにする。
 */
export type InferenceSkillDefinition = {
  id: string
  version: number
  enabled: boolean
  description: string
  activation: {
    minimumScore: number
    rules: readonly SkillActivationRule[]
  }
  requiredFacts: readonly string[]
  procedure: readonly string[]
  narrationPolicy: NarrationPolicy
  decision: string
  nextRoute: string
}

export type InferenceSkillContext = {
  step: Step
  reason: Reason | null
  input: string
  insight: Insight
  state: ConversationState
}

export type InferenceSkill = {
  definition: InferenceSkillDefinition
  execute(context: InferenceSkillContext): Draft
}

export type RoutedDraft = Draft & {
  narrationPolicy?: NarrationPolicy
  decisionTrace?: DecisionTrace
}
