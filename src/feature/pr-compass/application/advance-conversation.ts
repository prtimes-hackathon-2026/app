import {
  MAX_OBJECTIONS,
  phaseOf,
  type ConversationState,
  type Interest,
  type Phase,
  type Reason,
  type Step,
} from '../domain/conversation'
import type { Block } from '../domain/block'
import type { Insight } from '../domain/insight'
import type { InsightRepository } from '../domain/insight-repository'
import type { Classifier, Narrator } from '../domain/language'
import { readKeyPoints } from '../infrastructure/article-reader'
import { toScript } from '../infrastructure/voice.openai'

import {
  composeAlternative,
  composeBossSheet,
  composeDiagnosis,
  composeDoubt,
  composeHandoff,
  composeProposal,
  composeReason,
  composeWriteGuide,
  type Draft,
} from './compose-draft'

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

export type AdvanceInput = {
  companyId: number
  messages: readonly ChatMessage[]
  /** 前ターンまでのメモ。画面が持っていない場合は空でよい */
  memo?: string
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
}

/**
 * 画面は `{ role, content }` しか送ってこないので、状態は履歴から復元する。
 * アシスタントの発言数がそのまま進行度になる。
 */
function deriveStep(messages: readonly ChatMessage[]): Step {
  const turns = messages.filter((m) => m.role === 'assistant').length
  if (turns === 0) return 'diagnosis'
  if (turns === 1) return 'reason'
  if (turns === 2) return 'proposal'
  return 'react'
}

/**
 * 断られた回数。毎回すべてを分類し直すと LLM を何度も呼ぶことになるので、
 * 過去分は語句で拾い、最新の1件だけを分類にかける。
 */
const OBJECTION_HINT =
  /ピンとこ|ぴんとこ|しっくり|違う気|ちがう気|弱い|微妙|それはちょっと|うーん|合わな|あわな|他にな|別の|ほかの/

function countPastObjections(messages: readonly ChatMessage[]): number {
  // 提案（3ターン目）より後のユーザー発言だけを数える
  let assistantTurns = 0
  let count = 0
  for (const m of messages) {
    if (m.role === 'assistant') {
      assistantTurns += 1
      continue
    }
    if (assistantTurns >= 3 && OBJECTION_HINT.test(m.content)) count += 1
  }
  return count
}

const lastUserText = (messages: readonly ChatMessage[]) =>
  [...messages]
    .reverse()
    .find((m) => m.role === 'user')
    ?.content?.trim() ?? ''

/** 理由から関心を推定する。当たっていれば質問を1つ減らせる */
function inferInterest(reason: Reason): Interest {
  switch (reason) {
    case 'no_effect':
      return 'pv'
    case 'handover':
    case 'no_time':
    case 'no_topic':
    default:
      return 'topic'
  }
}

export type AdvanceConversation = (
  input: AdvanceInput,
) => Promise<AdvanceResult>

async function measured<T>(
  timings: Record<string, number>,
  name: string,
  work: () => Promise<T>,
): Promise<T> {
  const startedAt = performance.now()
  try {
    return await work()
  } finally {
    timings[name] = Math.round(performance.now() - startedAt)
  }
}

export function advanceConversation(deps: {
  insights: InsightRepository
  classifier: Classifier
  narrator: Narrator
}): AdvanceConversation {
  return async ({ companyId, messages, memo = '' }) => {
    const requestStartedAt = performance.now()
    const timings: Record<string, number> = {}
    const step = deriveStep(messages)
    const insight = await measured(timings, 'insights', () =>
      deps.insights.load(companyId, step === 'diagnosis' ? 'initial' : 'full'),
    )
    if (!insight) {
      return {
        content:
          '対象の企業が見つかりませんでした。設定を確認してからもう一度お試しください。',
        phase: 'discovery',
        memo,
        suggestions: [],
        speech: '',
        blocks: [],
      }
    }

    const text = lastUserText(messages)

    const state: ConversationState = {
      step,
      reason: null,
      interest: null,
      objections: countPastObjections(messages),
      handoffToHuman: false,
      finished: false,
    }

    const { draft, facts, suggestions, blocks } = await measured(
      timings,
      'route',
      () => route(step, text, insight, state, deps.classifier),
    )

    const history = messages.slice(-6)

    let enriched: readonly Block[]
    let spoken: string
    let nextMemo: string

    if (step === 'diagnosis') {
      // 初回は入力がまだ無く、下書きも事実だけで完成している。
      // LLMの言い換えを待たず、そのまま返して初回表示を優先する。
      enriched = blocks ?? []
      spoken = draft
      nextMemo = ''
      timings.articles = 0
      timings.narrator = 0
      timings.memo = 0
    } else {
      // 記事読み込み・言い換え・メモ生成は互いに独立しているので並行する。
      // 記事取得が失敗しても、従来どおりリンクだけを出して会話は止めない。
      const generated = await Promise.all([
        measured(timings, 'articles', () =>
          withKeyPoints(blocks, [text, draft].filter(Boolean).join('\n')),
        ),
        measured(timings, 'narrator', () =>
          deps.narrator.speak({ facts, draft, history }),
        ),
        measured(timings, 'memo', () =>
          deps.narrator.memo({
            facts,
            history,
            previous: memo,
          }),
        ),
      ])
      enriched = generated[0]
      spoken = generated[1]
      nextMemo = generated[2]
    }

    timings.total = Math.round(performance.now() - requestStartedAt)
    console.info(
      '[pr-compass:timing]',
      JSON.stringify({ companyId, step, ...timings }),
    )

    return {
      content: spoken,
      suggestions: suggestions ?? [],
      speech: toScript(spoken),
      blocks: enriched,
      // 書きに行くか、人に渡すかが決まったときだけ閉じる。
      // 断られただけで閉じてしまうと、粘る前に入力欄が消える
      phase: state.finished ? 'complete' : phaseOf(step),
      memo: nextMemo,
    }
  }
}

/** 先頭の記事だけ本文を読み、要点を添えて返す */
async function withKeyPoints(
  blocks: readonly Block[] | undefined,
  context: string,
): Promise<readonly Block[]> {
  if (!blocks?.length) return []

  const articleIndex = blocks.findIndex(
    (block) => block.type === 'articles' && block.items.length > 0,
  )
  if (articleIndex < 0) return blocks

  const block = blocks[articleIndex]
  if (block?.type !== 'articles') return blocks
  const [first, ...rest] = block.items
  if (!first) return blocks

  const points = await readKeyPoints(first.url, context)
  if (!points.length) return blocks

  return blocks.map((item, index) =>
    index === articleIndex
      ? { ...block, items: [{ ...first, points }, ...rest] }
      : item,
  )
}

/** 段ごとに、どの下書きを出すかを決める */
async function route(
  step: Step,
  text: string,
  insight: Insight,
  state: ConversationState,
  classifier: Classifier,
): Promise<Draft> {
  if (step === 'diagnosis') return composeDiagnosis(insight)

  if (step === 'reason') {
    const reason = await classifier.reason(text)
    state.reason = reason
    state.interest = inferInterest(reason)
    return composeReason(insight, reason)
  }

  if (step === 'proposal') {
    const interest = await classifier.interest(text)
    state.interest = interest
    return composeProposal(insight, interest)
  }

  // ここから先は提案への反応を受け続ける
  const reaction = await classifier.reaction(text)

  if (reaction === 'human') {
    state.handoffToHuman = true
    state.finished = true
    return composeHandoff(insight, state)
  }

  if (reaction === 'weak') {
    state.objections += 1
    if (state.objections >= MAX_OBJECTIONS) {
      state.handoffToHuman = true
      state.finished = true
      return composeHandoff(insight, state)
    }
    return composeAlternative(insight, state)
  }

  if (reaction === 'boss') return composeBossSheet(insight)
  if (reaction === 'doubt') return composeDoubt(insight)

  // write / more は同じ出口へ向かう。会話の目的は1本書いてもらうこと
  state.finished = true
  return composeWriteGuide(insight, state.interest ?? 'topic')
}
