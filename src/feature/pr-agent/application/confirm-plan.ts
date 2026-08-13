import { assertCanAdvance, type UserAnswer } from '../domain/conversation'
import type { ConversationRepository } from '../domain/conversation-repository'
import type {
  CompanyFactsPort,
  CompanyFactsSnapshot,
  FactsUnusedFeature,
} from '../domain/facts'
import { fallbackInterest, type InterestId } from '../domain/interest'
import type { FactSheet, NarratorPort } from '../domain/llm'
import type { Block, Turn } from '../domain/turn'

import { featuresOf, interestLabel, type ConversationCatalog } from './catalog'
import { count } from './format'
import { narrateWithGuard } from './narrate-with-guard'

/**
 * ターン 2 — 最初の一手を 1 つだけ返して終わる。
 *
 * 複数の案を並べると選ぶ手間に戻ってしまうので、blocks は next_step 1 つ。
 * 問いは無い (終端)。何を出すかはコードが決め、LLM は文章にしか触れない。
 */

export type ConfirmPlanDeps = {
  readonly facts: CompanyFactsPort
  readonly narrator: NarratorPort
  readonly conversations: ConversationRepository
  readonly catalog: ConversationCatalog
}

export type ConfirmPlanResult = {
  readonly conversationId: string
  readonly turn: Turn
}

/** 会話が見つからなければ null。ターン 2 以外への要求は例外で弾く */
export type ConfirmPlan = (
  conversationId: string,
  answer: UserAnswer,
) => Promise<ConfirmPlanResult | null>

type NextStep = {
  readonly action: string
  readonly detail: string
  readonly draft: string
  readonly facts: FactSheet
}

/** 未使用機能はそのまま一手になる。効果差分が分かっているものは差を添える */
function fromUnusedFeature(item: FactsUnusedFeature): NextStep {
  const action = `次の1本で${item.label}を使う`
  const impact = item.impact
  if (!impact) {
    return {
      action,
      detail: `御社の過去のリリースでは${item.detected}です。`,
      draft: `最初の一手は、次の1本で${item.label}を使うことです。御社の過去のリリースでは${item.detected}でした。ここだけ変えて1本出してみてください。`,
      facts: {
        最初の一手: action,
        御社が使っていない機能: `${item.label}（${item.detected}）`,
      },
    }
  }
  return {
    action,
    detail: `御社の過去のリリースでは${item.detected}です。同じ業種では、${item.label}があるリリースの当たり率が${impact.withPct}%、無いリリースが${impact.withoutPct}%でした。`,
    draft: `最初の一手は、次の1本で${item.label}を使うことです。御社の過去のリリースでは${item.detected}でした。同じ業種では${item.label}があるリリースの当たり率が${impact.withPct}%、無いリリースが${impact.withoutPct}%で、差があります。ここだけ変えて1本出してみてください。`,
    facts: {
      最初の一手: action,
      御社が使っていない機能: `${item.label}（${item.detected}）`,
      その機能があるリリースの当たり率: `${impact.withPct}%`,
      その機能が無いリリースの当たり率: `${impact.withoutPct}%`,
      効果差分を出したリリース数: `${count(impact.n)}本`,
    },
  }
}

/** 手を動かす先が無いときの一手。本数そのものが中心指標なので必ず成立する */
function fromReleaseCount(snapshot: CompanyFactsSnapshot): NextStep {
  const action = '次の1本を出す'
  const segment = snapshot.resume?.segment ?? null
  if (!segment) {
    return {
      action,
      detail: '本数がそのまま当たりを引く確率になります。',
      draft:
        '最初の一手は、次の1本を出すことです。1本ごとの当たり外れの幅が大きいので、本数がそのまま確率になります。',
      facts: { 最初の一手: action },
    }
  }
  return {
    action,
    detail: `同じところで止まってから再開した企業は、中央値で${segment.addedP50}本を追加しています。`,
    draft: `最初の一手は、次の1本を出すことです。同じところで止まってから再開した${count(segment.companies)}社は、中央値で${segment.addedP50}本を追加しています。まずその1本目です。`,
    facts: {
      最初の一手: action,
      再開した企業が追加した本数の中央値: `${segment.addedP50}本`,
      再開した企業数: `${count(segment.companies)}社`,
    },
  }
}

export function confirmPlan(deps: ConfirmPlanDeps): ConfirmPlan {
  const narrate = narrateWithGuard(deps.narrator)

  return async (conversationId, answer) => {
    const conversation = await deps.conversations.find(conversationId)
    if (!conversation) return null

    const next = assertCanAdvance(conversation)
    if (next !== 2) {
      throw new Error('ターン 2 に進める会話ではありません')
    }

    const snapshot = await deps.facts.load(conversation.companyId)
    if (!snapshot) return null

    const interest: InterestId = conversation.interest ?? fallbackInterest

    // 提案の候補。実在する機能とデータのある一手しか並ばない。
    // 末尾の「次の1本を出す」は必ず作れるので、候補が空にならない
    const candidates: NextStep[] = snapshot.unused
      .slice(0, 2)
      .map(fromUnusedFeature)
    const feature = featuresOf(deps.catalog, interest)[0]
    if (feature) {
      const action = `${feature.name}を使って1本出す`
      candidates.push({
        action,
        detail: `${feature.note}。`,
        draft: `最初の一手は、${feature.name}を使って次の1本を出すことです。${feature.note}。`,
        facts: { 最初の一手: action, 使う機能: feature.name },
      })
    }
    const baseline = fromReleaseCount(snapshot)
    candidates.push(baseline)

    // 先頭は効果差分の分かっている候補なので、明示的に「別の一手にしたい」と
    // 言われたときだけ次の候補に譲る。自由入力は同意とも否定とも取れるので動かさない
    const index = answer.choiceId === 'other' ? 1 : 0
    const picked =
      candidates[Math.min(index, candidates.length - 1)] ?? baseline

    const blocks: readonly [Block] = [
      {
        kind: 'next_step',
        title: '最初の一手',
        action: picked.action,
        detail: picked.detail,
      },
    ]

    const facts: FactSheet = {
      選ばれた関心: interestLabel(deps.catalog, interest),
      御社の配信本数: `${snapshot.history.totalReleases}本`,
      ...picked.facts,
    }

    // 終端なので問いは渡さない
    const narrative = await narrate({
      facts,
      draft: { next_step: picked.draft },
    })

    const turn: Turn = { turn: 2, blocks, narrative, question: null }
    await deps.conversations.appendTurn(conversationId, {
      role: 'user',
      payload: answer,
    })
    await deps.conversations.appendTurn(conversationId, {
      role: 'agent',
      payload: turn,
    })
    await deps.conversations.update(conversationId, {
      turn: next,
      status: 'completed',
    })

    return { conversationId, turn }
  }
}
