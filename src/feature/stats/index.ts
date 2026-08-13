import 'server-only'

import { getAgentDailyStats } from './application/get-agent-daily-stats'
import { drizzleAgentStatsRepository } from './infrastructure/agent-stats-repository.drizzle'

export type { AgentDailyStat, DateRange } from './domain/agent-daily-stat'

const repository = drizzleAgentStatsRepository()

export const statsFeature = {
  getAgentDailyStats: getAgentDailyStats(repository),
} as const
