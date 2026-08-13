import {
  bigint,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

/**
 * PR TIMES のデータ。この DB はこのアプリの管理外なので参照専用で扱う。
 *
 * ここに書いてあるのは「読み取るための型」であってスキーマの正ではない。
 * 定義は voice-agent プロトタイプが実 RDS に対して動かしていた SQL
 * (voice-agent/src/metrics.js) から起こしたもので、実接続での照合は済んでいない。
 * 繋いだら必ず `pnpm db:stats:pull` で引き直して差分を確認すること。
 *
 * release_statistic / release_keyword が (company_id, release_id) の複合キーである点に注意。
 * プロトタイプの JOIN 条件がそうなっている。release_id 単独では一意にならない。
 */

export const industry = pgTable('industry', {
  industryId: integer('industry_id').primaryKey(),
  industryName: text('industry_name'),
})

export const company = pgTable('company', {
  companyId: integer('company_id').primaryKey(),
  companyName: text('company_name'),
  industryId: integer('industry_id'),
  capital: bigint('capital', { mode: 'number' }),
  foundationDate: timestamp('foundation_date', { withTimezone: true }),
  description: text('description'),
})

export const releaseType = pgTable('release_type', {
  releaseTypeId: integer('release_type_id').primaryKey(),
  releaseTypeName: text('release_type_name'),
})

export const release = pgTable(
  'release',
  {
    companyId: integer('company_id').notNull(),
    releaseId: integer('release_id').notNull(),
    title: text('title'),
    subtitle: text('subtitle'),
    mainImage: text('main_image'),
    youtubeUrl: text('youtube_url'),
    releaseTypeId: integer('release_type_id'),
    createdAt: timestamp('created_at', { withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.companyId, table.releaseId] })],
)

export const releaseStatistic = pgTable(
  'release_statistic',
  {
    companyId: integer('company_id').notNull(),
    releaseId: integer('release_id').notNull(),
    pageView: integer('page_view'),
  },
  (table) => [primaryKey({ columns: [table.companyId, table.releaseId] })],
)

export const releaseKeyword = pgTable('release_keyword', {
  companyId: integer('company_id').notNull(),
  releaseId: integer('release_id').notNull(),
})

export type CompanyRow = typeof company.$inferSelect
export type IndustryRow = typeof industry.$inferSelect
export type ReleaseRow = typeof release.$inferSelect
export type ReleaseStatisticRow = typeof releaseStatistic.$inferSelect
export type ReleaseTypeRow = typeof releaseType.$inferSelect
