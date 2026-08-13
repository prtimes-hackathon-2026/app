import type { BucketLabel } from './bucket'

/**
 * 業種単位の指標。すべて voice-agent プロトタイプが実データで検証済みのもの。
 *
 * 中心指標は当たり率カーブ (HitCurve)。
 * 「PV の中央値は本数を重ねても伸びないが、ばらつきが極端に大きい。
 *   つまり 1 本ごとがくじであり、本数を重ねるほど当たりを引く確率が上がる」
 * という実測にもとづく。PV の平均や中央値の伸びを主張してはいけない。
 */

/** 配信本数別に、業種内 PV 上位 10% に届いた企業の割合 */
export type HitCurve = {
  readonly buckets: readonly {
    readonly bucket: BucketLabel
    readonly companies: number
    readonly hitPct: number
  }[]
  /** 「手応えのある結果」の境界。業種内 PV の 90 パーセンタイル */
  readonly thresholdPv: number
  readonly totalCompanies: number
}

/**
 * 初回配信からの経過期間別の当たり率。
 * 当たり率カーブと必ず対で使う。本数では 17%→87% に上がるが時間では 13%→23%
 * にしかならない、という対比があって初めて「時間ではなく本数」が成立する。
 */
export type PeriodCurve = {
  readonly rows: readonly {
    readonly months: number
    readonly companies: number
    readonly hitPct: number
    readonly releasesP50: number
    readonly cumPvP50: number
    readonly cumPvP90: number
  }[]
}

/** リリース種別ごとの傾向。最も多く出されている種別は埋もれやすい */
export type Trends = {
  readonly items: readonly {
    readonly releaseTypeName: string
    readonly n: number
    readonly pvP50: number | null
    readonly pvP90: number | null
  }[]
}

/** 6 か月以上休止してから再開した企業の前後比較 */
export type ResumeStats = {
  readonly segments: readonly ResumeSegment[]
  readonly gaps: readonly { readonly gap: string; readonly companies: number }[]
  readonly totalResumed: number
}

export type ResumeSegment = {
  /** 1: 休止前 1 本 / 2: 2〜3 本 / 3: 4〜10 本 / 4: 11 本以上 */
  readonly seg: number
  readonly fromN: number
  readonly toN: number
  readonly companies: number
  readonly hitBeforePct: number
  readonly hitAfterPct: number
  /** 再開後に追加した本数の中央値 */
  readonly addedP50: number
}

/** その企業の配信本数に対応する再開セグメントを選ぶ */
export function resumeSegmentFor(
  releaseCount: number,
  stats: ResumeStats | null,
): ResumeSegment | null {
  if (!stats?.segments.length) return null
  const seg =
    releaseCount <= 1 ? 1 : releaseCount <= 3 ? 2 : releaseCount <= 10 ? 3 : 4
  return stats.segments.find((s) => s.seg === seg) ?? null
}

/** 打ち手の有無による当たり率の差。同一業種内で算出する */
export type LeverKey =
  'main_image' | 'keyword' | 'title_number' | 'title_bracket'

export type Lever = {
  readonly on: { readonly n: number; readonly hitPct: number }
  readonly off: { readonly n: number; readonly hitPct: number }
  /** on / off の比。off が 0% のときは null */
  readonly ratio: number | null
}

export type Levers = Partial<Record<LeverKey, Lever>>

/** 業種単位の指標をまとめたもの。app DB にキャッシュする単位でもある */
export type IndustryMetrics = {
  readonly industryId: number
  readonly hitCurve: HitCurve | null
  readonly periodCurve: PeriodCurve | null
  readonly trends: Trends
  readonly resume: ResumeStats | null
  readonly levers: Levers
}
