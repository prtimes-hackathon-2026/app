import 'server-only'

import { salesFlowCasesFeature } from '@/feature/sales-flow-cases'

import { advanceConversation } from './application/advance-conversation'
import {
  openAiClassifier,
  openAiNarrator,
} from './infrastructure/language.openai'
import { drizzleCompanyDirectory } from './infrastructure/company-directory.drizzle'
import { drizzleInsightRepository } from './infrastructure/insight-repository.drizzle'
import { composeVoiceCommentary } from './infrastructure/voice-commentary.openai'
import { listen, speak, voiceReady } from './infrastructure/voice.openai'

export type {
  ChatMessage,
  AdvanceResult,
} from './application/advance-conversation'
export type { Phase } from './domain/conversation'
export type { StoppedCompany } from './domain/company-directory'
export type { VoiceContextMessage } from './infrastructure/voice-commentary.openai'

const companies = drizzleCompanyDirectory()

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
    salesFlowCases: salesFlowCasesFeature,
  }),
  /** 台本を音声にする。作れなければ null を返し、画面は音なしで進む */
  speak,
  /** 表示済みチャットを踏まえた、音声専用の短い発話を作る */
  composeVoiceCommentary,
  /** 話した音声を文字にする */
  listen,
  voiceReady,
  /**
   * ログイン後に「どの企業として使うか」を選ばせるための一覧。
   * 認証が利用者と企業を結びつけるようになったら要らなくなる。
   */
  findStoppedCompanies: (limit = 15) => companies.findStoppedCompanies(limit),
} as const
