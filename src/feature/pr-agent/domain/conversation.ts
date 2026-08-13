import type { InterestId } from './interest'
import type { Turn, TurnNumber } from './turn'

/**
 * 会話。ターンは 0 → 1 → 2 の 3 つしかない。
 *
 * 「4 往復を超えたら設計として失敗」という制約があるため、可変長ループにしない。
 * 進行は必ずこのモジュールの遷移関数を通す。
 */

export type ConversationStatus = 'in_progress' | 'completed' | 'abandoned'

/** 裏で推定する 3 層。相手には質問しないし、提示物にも出さない */
export type CompanyProfileGuess = {
  readonly top: string
  readonly middle: string
  readonly bottom: string
}

export type Conversation = {
  readonly id: string
  readonly companyId: number
  readonly status: ConversationStatus
  readonly turn: TurnNumber
  readonly interest: InterestId | null
  readonly profile: CompanyProfileGuess | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export type ConversationTurn = {
  readonly position: number
  readonly role: 'agent' | 'user'
  readonly payload: Turn | UserAnswer
}

export type UserAnswer = {
  readonly questionId: string
  readonly choiceId: string | null
  /** 自由入力。Classifier で 4 分類に割り当てる */
  readonly text: string | null
}

export function nextTurn(current: TurnNumber): TurnNumber | null {
  return current === 0 ? 1 : current === 1 ? 2 : null
}

export function isTerminal(turn: TurnNumber): boolean {
  return turn === 2
}

/** 遷移できない要求はここで弾く。ターン制御を LLM に渡さないための番人 */
export function assertCanAdvance(conversation: Conversation): TurnNumber {
  if (conversation.status !== 'in_progress') {
    throw new Error('この会話はすでに終了しています')
  }
  const next = nextTurn(conversation.turn)
  if (next === null) {
    throw new Error('会話は 3 ターンで終わります')
  }
  return next
}
