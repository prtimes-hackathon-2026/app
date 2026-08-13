import 'server-only'

import { getAgent } from './application/get-agent'
import { listAgents } from './application/list-agents'
import { drizzleAgentRepository } from './infrastructure/agent-repository.drizzle'

export type { Agent, AgentId, AgentStatus } from './domain/agent'
export { agentStatuses } from './domain/agent'

/**
 * この feature の合成ルート。app 層からはこのオブジェクト経由でのみ呼び出す。
 * 実装の差し替え (テストダブルなど) はここだけを変えれば済む。
 */
const repository = drizzleAgentRepository()

export const agentsFeature = {
  listAgents: listAgents(repository),
  getAgent: getAgent(repository),
} as const
