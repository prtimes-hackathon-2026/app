import {
  INTEREST_FROM_REASON,
  MAX_OBJECTIONS,
  MAX_STALLS,
  OBJECTION_ORDER,
  initialState,
  phaseOf,
  type ConversationState,
  type Interest,
  type Objection,
  type Phase,
  type Reason,
} from '../domain/conversation'
import type { Block } from '../domain/block'
import type { Insight } from '../domain/insight'
import type { InsightRepository } from '../domain/insight-repository'
import type { Classifier, Narrator } from '../domain/language'
import { toScript } from '../infrastructure/voice.openai'

import {
  composeAlternative,
  composeBossSheet,
  composeDiagnosis,
  composeDoubt,
  composeHandoff,
  composeInterestRetry,
  composeProposal,
  composeReactRetry,
  composeReason,
  composeReasonRetry,
  composeWriteGuide,
  type Draft,
} from './compose-draft'

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

export type AdvanceInput = {
  companyId: number
  messages: readonly ChatMessage[]
  /** 前ターンまでのメモ。画面が持っていない場合は空でよい */
  memo?: string
  /** 前ターンまでの状態。初回は無い */
  state?: ConversationState | null
}

export type AdvanceResult = {
  content: string
  phase: Phase
  memo: string
  /** 入力の助けとして画面に出す。選ばせるためではないので、押しても送信はしない */
  suggestions: readonly string[]
  /**
   * 読み上げ用の台本。本文をそのまま読ませると1分の独白になるので、
   * 頭の2文だけを耳向けに整形したもの。詳細は画面で読んでもらう。
   */
  speech: string
  /** 数値を描く部品。本文が言い換えで揺れても、ここの数字は変わらない */
  blocks: readonly Block[]
  /**
   * 次のターンでそのまま返してもらう。会話がどこまで進んだかはこれだけが持つ。
   * 画面は中身を読まない
   */
  state: ConversationState
}

const lastUserText = (messages: readonly ChatMessage[]) =>
  [...messages]
    .reverse()
    .find((m) => m.role === 'user')
    ?.content?.trim() ?? ''

export type AdvanceConversation = (
  input: AdvanceInput,
) => Promise<AdvanceResult>

export function advanceConversation(deps: {
  insights: InsightRepository
  classifier: Classifier
  narrator: Narrator
}): AdvanceConversation {
  return async ({ companyId, messages, memo = '', state }) => {
    const current = state ?? initialState()
    const insight = await deps.insights.load(companyId)
    if (!insight) {
      return {
        content:
          '対象の企業が見つかりませんでした。設定を確認してからもう一度お試しください。',
        phase: phaseOf(current.step),
        memo,
        suggestions: [],
        speech: '',
        blocks: [],
        state: current,
      }
    }

    const { reply, next } = await route(
      current,
      lastUserText(messages),
      insight,
      deps.classifier,
    )

    const history = messages.slice(-6)
    const spoken = await deps.narrator.speak({
      facts: reply.facts,
      draft: reply.draft,
      history,
    })

    const nextMemo = await deps.narrator.memo({
      facts: reply.facts,
      history,
      previous: memo,
    })

    return {
      content: spoken,
      suggestions: reply.suggestions ?? [],
      speech: toScript(spoken),
      blocks: reply.blocks ?? [],
      // 次に何を聞くかがそのままフェーズになる。
      // 書きに行くか人に渡すかが決まったときだけ complete になる
      phase: phaseOf(next.step),
      memo: nextMemo,
      state: next,
    }
  }
}

/** 1ターン分の返答と、そのあとの状態 */
type Turn = { reply: Draft; next: ConversationState }

/**
 * 段ごとに、聞いたことが取れたかを分類器に判定させる。
 * 取れたときだけ次の段へ進み、取れなければ同じ段に留まって聞き直す。
 */
async function route(
  state: ConversationState,
  text: string,
  insight: Insight,
  classifier: Classifier,
): Promise<Turn> {
  // ① 診断。相手の答えを待たずに出す唯一の段
  if (state.step === 'diagnosis') {
    return {
      reply: composeDiagnosis(insight),
      next: { ...state, step: 'reason', stalls: 0 },
    }
  }

  // ② 止まった理由。取れるまで提案には進まない
  if (state.step === 'reason') {
    const reason = await classifier.reason(text)
    if (reason !== null) return prescribe(insight, state, reason)

    const stalls = state.stalls + 1
    if (stalls < MAX_STALLS) {
      return { reply: composeReasonRetry(insight), next: { ...state, stalls } }
    }
    // 聞き直しても取れない。ここで粘るより、理由なしとして先へ進むほうが早い
    return prescribe(insight, state, 'none')
  }

  // ③ 何をしたいか
  if (state.step === 'interest') {
    const interest = await classifier.interest(text)
    if (interest !== null) return propose(insight, state, interest)

    const stalls = state.stalls + 1
    if (stalls < MAX_STALLS) {
      return {
        reply: composeInterestRetry(insight),
        next: { ...state, stalls },
      }
    }
    // 理由から推定した関心がある。同じことを聞き続けるより、それで出す
    return propose(insight, state, state.interest ?? 'topic')
  }

  // ④ 提案への反応。complete のあとに送られてきた場合もここで受ける
  return react(insight, state, text, classifier)
}

/** 理由が取れた。処方を出して、次は「何をしたいか」を聞く */
function prescribe(
  insight: Insight,
  state: ConversationState,
  reason: Reason,
): Turn {
  return {
    reply: composeReason(insight, reason),
    next: {
      ...state,
      step: 'interest',
      reason,
      // 理由が分かれば関心はほぼ推定できる。次の段で取れなかったときに使う
      interest: INTEREST_FROM_REASON[reason],
      stalls: 0,
    },
  }
}

/** 関心が取れた。提案を出して、次は反応を聞く */
function propose(
  insight: Insight,
  state: ConversationState,
  interest: Interest,
): Turn {
  return {
    reply: composeProposal(insight, interest),
    next: { ...state, step: 'react', interest, stalls: 0 },
  }
}

/** 提案への反応を受ける。ここは何度でも回る */
async function react(
  insight: Insight,
  state: ConversationState,
  text: string,
  classifier: Classifier,
): Promise<Turn> {
  const reaction = await classifier.reaction(text)

  if (reaction === null) {
    const stalls = state.stalls + 1
    if (stalls < MAX_STALLS) {
      return {
        reply: composeReactRetry(insight),
        next: { ...state, step: 'react', stalls },
      }
    }
    // 何度聞いても意図が取れない。対話では解けないので人に渡す
    return handoff(insight, state)
  }

  const base: ConversationState = { ...state, step: 'react', stalls: 0 }

  if (reaction === 'human') return handoff(insight, base)

  if (reaction === 'weak') {
    const objections = base.objections + 1
    if (objections >= MAX_OBJECTIONS) {
      return handoff(insight, { ...base, objections })
    }
    const drawer = pickDrawer(base, await classifier.objection(text))
    return {
      reply: composeAlternative(insight, { ...base, objections }, drawer),
      next: { ...base, objections, tried: [...base.tried, drawer] },
    }
  }

  if (reaction === 'boss')
    return { reply: composeBossSheet(insight), next: base }
  if (reaction === 'doubt') return { reply: composeDoubt(insight), next: base }

  // more は書き方を見せるだけ。書くと決まったわけではないので閉じない
  const guide = composeWriteGuide(insight, base.interest ?? 'topic')
  if (reaction === 'more') return { reply: guide, next: base }

  // write。ここで初めて会話を閉じる
  return { reply: guide, next: { ...base, step: 'complete' } }
}

/** 人に渡す。ここで会話は閉じる */
function handoff(insight: Insight, state: ConversationState): Turn {
  const next: ConversationState = {
    ...state,
    step: 'complete',
    handoffToHuman: true,
    stalls: 0,
  }
  return { reply: composeHandoff(insight, next), next }
}

/**
 * どの引き出しを開けるか。分類が同じ結果に偏っても、同じ切り口は二度出さない。
 * 分類できなかった場合も、まだ開けていない引き出しから順に出す。
 */
function pickDrawer(
  state: ConversationState,
  objection: Objection | null,
): Objection {
  if (objection !== null && !state.tried.includes(objection)) return objection
  return (
    OBJECTION_ORDER.find((o) => !state.tried.includes(o)) ??
    objection ??
    OBJECTION_ORDER[0]
  )
}
