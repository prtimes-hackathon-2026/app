import type { Agent, AgentId } from '../domain/agent'
import type { AgentRepository } from '../domain/agent-repository'

export type GetAgent = (id: AgentId) => Promise<Agent | null>

export function getAgent(repository: AgentRepository): GetAgent {
  return (id) => repository.findById(id)
}
