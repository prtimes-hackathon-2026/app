import type {
  Conversation,
  ConversationTurn,
} from '../domain/conversation'
import type { ConversationRepository } from '../domain/conversation-repository'

/**
 * 会話とそれまでのターンをまとめて読む。
 *
 * 画面は描画の正をここに一本化している。回答の POST が返した内容で描き直すと、
 * JSON を通った時点で Date が文字列になり Turn 型が崩れるため。
 */
export type GetConversationResult = {
  readonly conversation: Conversation
  readonly turns: readonly ConversationTurn[]
}

export type GetConversation = (
  conversationId: string,
) => Promise<GetConversationResult | null>

export function getConversation(
  conversations: ConversationRepository,
): GetConversation {
  return async (conversationId) => {
    const conversation = await conversations.find(conversationId)
    if (conversation === null) return null

    const turns = await conversations.findTurns(conversationId)
    return { conversation, turns }
  }
}
