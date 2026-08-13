import 'server-only'

import { findStoppedCompanies } from './application/find-stopped-companies'
import { getCompanyFacts } from './application/get-company-facts'
import { drizzleIndustryMetricsCache } from './infrastructure/industry-metrics-cache.drizzle'
import { cachedMetricsRepository } from './infrastructure/metrics-repository.cached'
import { drizzleMetricsRepository } from './infrastructure/metrics-repository.drizzle'
import { mockMetricsRepository } from './infrastructure/metrics-repository.mock'

export type { CompanyFactsBundle } from './domain/company-facts-bundle'
export type { StoppedCompany } from './domain/metrics-repository'

/**
 * PR TIMES DB に繋がっていなければ模擬データで動かす (設計 §4 の全経路 degrade)。
 *
 * env() を使わず生の環境変数を見ているのは、env() が未設定なら例外を投げる作りで、
 * 「未設定かどうか」を判定する用途に使えないため。shouldMigrateOnStartup() が
 * 同じ理由で生の環境変数を見ているのに合わせている。
 */
const usingMock = !process.env.STATS_DATABASE_URL?.trim()

/**
 * この feature の合成ルート。他の feature / app 層からはこのオブジェクト経由で呼ぶ。
 * 業種単位の集計だけキャッシュで包む。模擬データ側は元から軽いので包まない。
 */
const repository = usingMock
  ? mockMetricsRepository()
  : cachedMetricsRepository(
      drizzleMetricsRepository(),
      drizzleIndustryMetricsCache(),
    )

export const prMetricsFeature = {
  getCompanyFacts: getCompanyFacts(repository, usingMock ? 'mock' : 'measured'),
  findStoppedCompanies: findStoppedCompanies(repository),
} as const
