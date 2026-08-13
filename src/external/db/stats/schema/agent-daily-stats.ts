import { date, integer, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core'

/**
 * 統計 DB のテーブル定義。
 *
 * この DB はこのアプリの管理外なので、ここに書くのは「読み取るための型」であって
 * スキーマの正ではない。実体が変わったら `pnpm db:stats:pull` で引き直し、
 * `drizzle/stats/schema.ts` の内容をここへ写すこと。
 * このリポジトリからマイグレーションを流してはいけない。
 */
export const agentDailyStats = pgTable(
  'agent_daily_stats',
  {
    agentId: uuid('agent_id').notNull(),
    date: date('date').notNull(),
    runCount: integer('run_count').default(0).notNull(),
    successCount: integer('success_count').default(0).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.agentId, table.date],
      name: 'agent_daily_stats_pkey',
    }),
  ],
)

export type AgentDailyStatRow = typeof agentDailyStats.$inferSelect
