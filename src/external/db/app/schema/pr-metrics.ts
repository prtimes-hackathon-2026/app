import { integer, jsonb, pgTable, timestamp } from 'drizzle-orm/pg-core'

/**
 * 業種単位の集計のキャッシュ。
 *
 * 集計は PR TIMES DB の業種全件スキャンで、調査時は statement_timeout を
 * 150〜180 秒まで上げて回していたほど重い。プロトタイプはプロセス内 Map に
 * 持っていたが、ECS では複数タスクがそれぞれ温め直すことになるため、
 * このアプリ側の DB に置いてタスク間で共有する。
 *
 * 中身は PR TIMES DB から再計算できる派生データなので、消えても正しさは損なわれない。
 */
export const prIndustryMetrics = pgTable('pr_industry_metrics', {
  /** PR TIMES 側の industry_id。DB が別なので外部キーは張らない */
  industryId: integer('industry_id').primaryKey(),
  metrics: jsonb('metrics').$type<unknown>().notNull(),
  computedAt: timestamp('computed_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export type PrIndustryMetricsRow = typeof prIndustryMetrics.$inferSelect
export type NewPrIndustryMetricsRow = typeof prIndustryMetrics.$inferInsert
