import { date, integer, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core'

/**
 * 統計 DB のテーブル定義。
 *
 * この DB はこのアプリの管理外なので、ここに書くのは「読み取るための型」であって
 * スキーマの正ではない。実体が変わったら `pnpm db:stats:pull` で引き直すこと。
 * このリポジトリからマイグレーションを流してはいけない。
 */
export const agentDailyStats = pgTable(
  'agent_daily_stats',
  {
    agentId: uuid('agent_id').notNull(),
    date: date('date').notNull(),
    runCount: integer('run_count').notNull(),
    successCount: integer('success_count').notNull(),
  },
  (table) => [primaryKey({ columns: [table.agentId, table.date] })],
)

export type AgentDailyStatRow = typeof agentDailyStats.$inferSelect
