import type { AgentDailyStat, DateRange } from './agent-daily-stat'

/** 統計 DB は参照専用のため、読み取りの操作しか公開しない */
export interface AgentStatsRepository {
  findDailyStats(
    agentId: string,
    range: DateRange,
  ): Promise<readonly AgentDailyStat[]>
}
