import type { DecisionTrace } from '../../domain/decision-trace'

import type {
  InferenceSkill,
  InferenceSkillContext,
  RoutedDraft,
  SkillActivationRule,
} from './inference-skill'
import { noEffectSkill } from './no-effect.skill'

function validateRegistry(skills: readonly InferenceSkill[]) {
  const ids = new Set<string>()
  for (const skill of skills) {
    const { id, version, activation } = skill.definition
    if (ids.has(id)) throw new Error(`Duplicate inference skill: ${id}`)
    ids.add(id)

    if (!Number.isInteger(version) || version < 1) {
      throw new Error(`Invalid inference skill version: ${id}`)
    }
    if (
      !Number.isFinite(activation.minimumScore) ||
      activation.minimumScore <= 0 ||
      activation.rules.length === 0 ||
      activation.rules.some(
        (rule) => !Number.isFinite(rule.weight) || rule.weight <= 0,
      ) ||
      activation.rules.reduce((sum, rule) => sum + rule.weight, 0) <
        activation.minimumScore
    ) {
      throw new Error(`Invalid inference skill activation: ${id}`)
    }
  }
  return skills
}

const REGISTERED_SKILLS = validateRegistry([noEffectSkill]).filter(
  (skill) => skill.definition.enabled,
)

function readPath(root: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (value === null || typeof value !== 'object') return undefined
    return (value as Record<string, unknown>)[key]
  }, root)
}

function valueOf(context: InferenceSkillContext, rule: SkillActivationRule) {
  return rule.field === 'step' ? context.step : context.reason
}

function selectSkill(context: InferenceSkillContext) {
  return REGISTERED_SKILLS.map((skill) => {
    const matchedRules = skill.definition.activation.rules.filter(
      (rule) => valueOf(context, rule) === rule.equals,
    )
    const score = matchedRules.reduce((sum, rule) => sum + rule.weight, 0)
    const missingFacts = skill.definition.requiredFacts.filter((path) => {
      const value = readPath(context, path)
      return value === undefined || value === null
    })
    return { skill, matchedRules, score, missingFacts }
  })
    .filter(
      ({ skill, score, missingFacts }) =>
        missingFacts.length === 0 &&
        score >= skill.definition.activation.minimumScore,
    )
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.skill.definition.id.localeCompare(b.skill.definition.id),
    )[0]
}

/** 最高スコアの Skill を1つだけ実行する。該当しなければ既存ルートへ戻す。 */
export function runInferenceSkill(
  context: InferenceSkillContext,
): RoutedDraft | null {
  const selected = selectSkill(context)
  if (!selected) return null

  const { skill, matchedRules, score } = selected
  const output = skill.execute(context)
  const trace: DecisionTrace = {
    step: context.step,
    skill: {
      id: skill.definition.id,
      version: skill.definition.version,
      score,
      minimumScore: skill.definition.activation.minimumScore,
    },
    matchedRules: matchedRules.map((rule) => `${rule.id}: ${rule.description}`),
    evidence: Object.entries(output.facts).map(([label, value]) => ({
      label,
      value,
    })),
    decision: skill.definition.decision,
    nextRoute: skill.definition.nextRoute,
    validations: [],
  }

  return {
    ...output,
    narrationPolicy: {
      ...skill.definition.narrationPolicy,
      instructions: [
        ...skill.definition.procedure,
        ...skill.definition.narrationPolicy.instructions,
      ],
    },
    decisionTrace: trace,
  }
}
