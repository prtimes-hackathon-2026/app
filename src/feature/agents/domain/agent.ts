export const agentStatuses = ['active', 'inactive', 'archived'] as const

export type AgentStatus = (typeof agentStatuses)[number]

export type AgentId = string

export type Agent = {
  readonly id: AgentId
  readonly name: string
  readonly description: string | null
  readonly status: AgentStatus
  readonly createdAt: Date
  readonly updatedAt: Date
}
