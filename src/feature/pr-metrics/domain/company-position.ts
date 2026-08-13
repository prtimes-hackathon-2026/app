/** 対象企業そのものの情報。業種単位の指標と違い、軽いクエリで毎回取る */
export type CompanyProfile = {
  readonly companyId: number
  readonly companyName: string | null
  readonly industryId: number | null
  readonly industryName: string | null
  readonly capital: number | null
  readonly foundationDate: Date | null
  readonly description: string | null
}

export type ReleaseSummary = {
  readonly title: string | null
  readonly releasedAt: Date | null
  readonly pageView: number | null
}

export type CompanyHistory = {
  readonly totalReleases: number
  readonly firstReleasedAt: Date | null
  readonly lastReleasedAt: Date | null
  /** 最後の配信からの経過月数。1 本も無ければ null */
  readonly stoppedMonths: number | null
  /** 直近 5 本 */
  readonly recent: readonly ReleaseSummary[]
}

/** 未使用機能の検出に使う、企業単位の集計値 */
export type FeatureUsage = {
  readonly total: number
  readonly noImage: number
  readonly noVideo: number
  readonly noSubtitle: number
  readonly releaseTypes: number
  readonly avgKeywords: number
  readonly titlesWithNumber: number
  readonly titlesWithBracket: number
}
