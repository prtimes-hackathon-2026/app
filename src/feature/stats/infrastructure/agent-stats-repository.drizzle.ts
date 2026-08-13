import 'server-only'

import { and, between, eq } from 'drizzle-orm'

import { statsDb, statsSchema } from '@/external/db/stats'

import type { AgentDailyStat } from '../domain/agent-daily-stat'
import type { AgentStatsRepository } from '../domain/agent-stats-repository'

function toAgentDailyStat(row: statsSchema.AgentDailyStatRow): AgentDailyStat {
  return {
    agentId: row.agentId,
    date: row.date,
    runCount: row.runCount,
    successCount: row.successCount,
  }
}

export function drizzleAgentStatsRepository(): AgentStatsRepository {
  return {
    async findDailyStats(agentId, range) {
      const rows = await statsDb()
        .select()
        .from(statsSchema.agentDailyStats)
        .where(
          and(
            eq(statsSchema.agentDailyStats.agentId, agentId),
            between(statsSchema.agentDailyStats.date, range.from, range.to),
          ),
        )
      return rows.map(toAgentDailyStat)
    },
  }
}
