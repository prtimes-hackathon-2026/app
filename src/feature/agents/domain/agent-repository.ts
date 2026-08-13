import type { Agent, AgentId } from './agent'

/**
 * 永続化のポート。実装 (アダプタ) は infrastructure 側に置く。
 * ここに ORM や SQL の語彙を持ち込まないこと。
 */
export interface AgentRepository {
  list(): Promise<readonly Agent[]>
  findById(id: AgentId): Promise<Agent | null>
}
