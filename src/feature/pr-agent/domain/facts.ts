/**
 * pr-metrics から受け取る事実のスナップショット。
 *
 * 型を pr-metrics から import せず、ここで構造的に再定義しているのは意図的。
 * domain / application は他 feature を知らない。
 * 変換は infrastructure/company-facts.pr-metrics.ts が行う。
 */

export type FactsCompany = {
  readonly companyId: number
  readonly companyName: string | null
  readonly industryId: number | null
  readonly industryName: string | null
  readonly description: string | null
}

export type FactsRelease = {
  readonly title: string | null
  readonly releasedAt: Date | null
  readonly pageView: number | null
}

export type FactsHistory = {
  readonly totalReleases: number
  readonly lastReleasedAt: Date | null
  readonly stoppedMonths: number | null
  readonly recent: readonly FactsRelease[]
}

export type FactsHitCurve = {
  readonly buckets: readonly {
    readonly bucket: string
    readonly companies: number
    readonly hitPct: number
  }[]
  readonly thresholdPv: number
  readonly totalCompanies: number
}

export type FactsPeriodCurve = {
  readonly rows: readonly {
    readonly months: number
    readonly companies: number
    readonly hitPct: number
    readonly releasesP50: number
    readonly cumPvP50: number
    readonly cumPvP90: number
  }[]
}

export type FactsTrends = {
  readonly items: readonly {
    readonly releaseTypeName: string
    readonly n: number
    readonly pvP50: number | null
    readonly pvP90: number | null
  }[]
}

export type FactsResumeSegment = {
  readonly fromN: number
  readonly toN: number
  readonly companies: number
  readonly hitBeforePct: number
  readonly hitAfterPct: number
  readonly addedP50: number
}

export type FactsResume = {
  readonly segment: FactsResumeSegment | null
  readonly gaps: readonly { readonly gap: string; readonly companies: number }[]
  readonly totalResumed: number
}

export type FactsUnusedFeature = {
  readonly key: string
  readonly label: string
  readonly detected: string
  readonly impact: {
    readonly withPct: number
    readonly withoutPct: number
    readonly ratio: number
    readonly n: number
  } | null
}

export type CompanyFactsSnapshot = {
  readonly company: FactsCompany
  readonly history: FactsHistory
  readonly bucket: string
  readonly hitCurve: FactsHitCurve | null
  readonly periodCurve: FactsPeriodCurve | null
  readonly trends: FactsTrends
  readonly resume: FactsResume | null
  readonly unused: readonly FactsUnusedFeature[]
  /** 模擬データか実データか。表記はコードが付与し、LLM には書かせない */
  readonly source: 'mock' | 'measured'
}

/** pr-metrics への窓口。実装は infrastructure に置く */
export interface CompanyFactsPort {
  load(companyId: number): Promise<CompanyFactsSnapshot | null>
}
