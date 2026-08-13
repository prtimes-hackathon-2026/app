import type { Agent } from '../domain/agent'
import type { AgentRepository } from '../domain/agent-repository'

export type ListAgents = () => Promise<readonly Agent[]>

export function listAgents(repository: AgentRepository): ListAgents {
  return () => repository.list()
}
