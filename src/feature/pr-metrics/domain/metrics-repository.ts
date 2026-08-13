import type {
  CompanyHistory,
  CompanyProfile,
  FeatureUsage,
} from './company-position'
import type {
  HitCurve,
  Levers,
  PeriodCurve,
  ResumeStats,
  Trends,
} from './metrics'

/**
 * PR TIMES DB は参照専用のため読み取りしか公開しない。
 *
 * 業種単位の集計 (findHitCurve 以下) は業種全件スキャンになるため重い。
 * 呼び出し側でキャッシュする前提で、ここでは素直に毎回計算する実装を置く。
 */
export interface MetricsRepository {
  findCompany(companyId: number): Promise<CompanyProfile | null>
  findHistory(companyId: number): Promise<CompanyHistory>
  findFeatureUsage(companyId: number): Promise<FeatureUsage>

  findHitCurve(industryId: number): Promise<HitCurve | null>
  findPeriodCurve(industryId: number): Promise<PeriodCurve | null>
  findTrends(industryId: number): Promise<Trends>
  findResumeStats(industryId: number): Promise<ResumeStats | null>
  findLevers(industryId: number): Promise<Levers>

  /** デモ対象を探す: 配信が少なく、しばらく止まっている企業 */
  findStoppedCompanies(limit: number): Promise<readonly StoppedCompany[]>
}

export type StoppedCompany = {
  readonly companyId: number
  readonly companyName: string | null
  readonly industryName: string | null
  readonly releases: number
  readonly lastReleasedAt: Date | null
}

/** 業種単位の指標のキャッシュ。app DB 側に置く */
export interface IndustryMetricsCache {
  get(industryId: number): Promise<CachedIndustryMetrics | null>
  set(industryId: number, metrics: unknown): Promise<void>
}

export type CachedIndustryMetrics = {
  readonly metrics: unknown
  readonly computedAt: Date
}
