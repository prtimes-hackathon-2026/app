import 'server-only'

import {
  articlesByInterest,
  bucketOf,
  featuresByInterest,
  interests,
} from '@/feature/pr-metrics'

import { answerInterest } from './application/answer-interest'
import type { ConversationCatalog } from './application/catalog'
import { confirmPlan } from './application/confirm-plan'
import { getConversation } from './application/get-conversation'
import { startConversation } from './application/start-conversation'
import type { UserAnswer } from './domain/conversation'
import { openaiClassifier } from './infrastructure/classifier.openai'
import { prMetricsCompanyFacts } from './infrastructure/company-facts.pr-metrics'
import { drizzleConversationRepository } from './infrastructure/conversation-repository.drizzle'
import { openaiNarrator } from './infrastructure/narrator.openai'
import { openaiProfiler } from './infrastructure/profiler.openai'

export type {
  Conversation,
  ConversationTurn,
  UserAnswer,
} from './domain/conversation'
export type { InterestId } from './domain/interest'
export type {
  Block,
  Evidence,
  Narrative,
  OutlookStep,
  Question,
  Turn,
  TurnNumber,
} from './domain/turn'

/**
 * 提示に使うカタログの正は pr-metrics 側にある。
 * domain / application は他 feature を知らないので、値をここで注入する。
 * 提案できる機能がこの 1 か所に閉じるため、LLM は機能名を作れない。
 */
const catalog: ConversationCatalog = {
  interests,
  features: featuresByInterest,
  articles: articlesByInterest,
  bucketOf,
}

const conversations = drizzleConversationRepository()
const facts = prMetricsCompanyFacts()
const narrator = openaiNarrator()
const classifier = openaiClassifier()
const profiler = openaiProfiler()

const start = startConversation({
  facts,
  narrator,
  profiler,
  conversations,
  catalog,
})
const answerTurn1 = answerInterest({
  facts,
  narrator,
  classifier,
  conversations,
  catalog,
})
const answerTurn2 = confirmPlan({ facts, narrator, conversations, catalog })
const get = getConversation(conversations)

/**
 * 回答を 1 つ受けて次のターンへ進める。
 *
 * どのユースケースを呼ぶかは会話が今いるターンだけで決まる。
 * 分岐をここに閉じておくことで、呼び出し側 (app 層) がターン番号を持たずに済み、
 * 「3 ターンで終わる」という制約が feature の外に漏れない。
 * 遷移そのものの可否は application 側の assertCanAdvance が判定する。
 */
async function answer(conversationId: string, userAnswer: UserAnswer) {
  const found = await get(conversationId)
  if (found === null) return null

  return found.conversation.turn === 0
    ? answerTurn1(conversationId, userAnswer)
    : answerTurn2(conversationId, userAnswer)
}

export const prAgentFeature = {
  start,
  answer,
  get,
} as const
