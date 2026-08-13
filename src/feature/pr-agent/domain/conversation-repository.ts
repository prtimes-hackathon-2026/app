import type {
  CompanyProfileGuess,
  Conversation,
  ConversationTurn,
} from './conversation'
import type { InterestId } from './interest'
import type { TurnNumber } from './turn'

export interface ConversationRepository {
  create(companyId: number): Promise<Conversation>
  find(id: string): Promise<Conversation | null>
  findTurns(id: string): Promise<readonly ConversationTurn[]>

  /** ターンを 1 つ進める。position の採番はここで閉じる */
  appendTurn(
    id: string,
    turn: Omit<ConversationTurn, 'position'>,
  ): Promise<void>

  update(
    id: string,
    patch: {
      readonly turn?: TurnNumber
      readonly interest?: InterestId
      readonly profile?: CompanyProfileGuess
      readonly status?: Conversation['status']
    },
  ): Promise<void>
}
