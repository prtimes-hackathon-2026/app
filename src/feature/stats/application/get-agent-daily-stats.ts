import type { AgentDailyStat, DateRange } from '../domain/agent-daily-stat'
import type { AgentStatsRepository } from '../domain/agent-stats-repository'

export type GetAgentDailyStats = (
  agentId: string,
  range: DateRange,
) => Promise<readonly AgentDailyStat[]>

export function getAgentDailyStats(
  repository: AgentStatsRepository,
): GetAgentDailyStats {
  return (agentId, range) => {
    if (range.from > range.to) {
      throw new RangeError('from は to 以前の日付である必要があります')
    }
    return repository.findDailyStats(agentId, range)
  }
}
