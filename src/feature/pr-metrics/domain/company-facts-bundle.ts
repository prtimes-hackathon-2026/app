/**
 * pr-agent へ引き渡す事実のスナップショット。
 *
 * pr-agent/domain/facts.ts の CompanyFactsSnapshot と同じ構造を、こちらでも別に
 * 定義している。この二重定義は意図的なもので、feature 同士は互いの内部
 * (@/feature/<domain>/domain/...) を import できないため (ESLint が落とす)。
 * 型を共有せず構造だけを一致させておけば、構造的部分型でそのまま渡せる。
 *
 * したがってフィールドは facts.ts の写しであり、独自に増やしてはいけない。
 * 片方を変えたら必ずもう片方も合わせること (ずれると受け渡しの箇所で型が落ちる)。
 * bucket などを BucketLabel ではなく string にしているのも facts.ts に合わせたため。
 */

/** 模擬データか実データか。表記はコードが付与し、LLM には書かせない */
export type FactsSource = 'mock' | 'measured'

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

export type CompanyFactsBundle = {
  readonly company: FactsCompany
  readonly history: FactsHistory
  readonly bucket: string
  readonly hitCurve: FactsHitCurve | null
  readonly periodCurve: FactsPeriodCurve | null
  readonly trends: FactsTrends
  readonly resume: FactsResume | null
  readonly unused: readonly FactsUnusedFeature[]
  readonly source: FactsSource
}
