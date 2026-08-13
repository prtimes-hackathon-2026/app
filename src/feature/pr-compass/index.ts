import 'server-only'

import { advanceConversation } from './application/advance-conversation'
import {
  openAiClassifier,
  openAiNarrator,
} from './infrastructure/language.openai'
import { drizzleInsightRepository } from './infrastructure/insight-repository.drizzle'
import { listen, speak, voiceReady } from './infrastructure/voice.openai'

export type {
  ChatMessage,
  AdvanceResult,
} from './application/advance-conversation'
export type { Phase } from './domain/conversation'

/**
 * この feature の合成ルート。app 層からはこのオブジェクト経由でのみ呼び出す。
 *
 * 数値は insight repository（SQL）でしか作られない。
 * classifier は自由入力を分岐に落とすだけ、narrator は下書きを言い換えるだけで、
 * どちらも数値を作る経路を持たない。
 */
export const prCompassFeature = {
  advanceConversation: advanceConversation({
    insights: drizzleInsightRepository(),
    classifier: openAiClassifier(),
    narrator: openAiNarrator(),
  }),
  /** 台本を音声にする。作れなければ null を返し、画面は音なしで進む */
  speak,
  /** 話した音声を文字にする */
  listen,
  voiceReady,
} as const
