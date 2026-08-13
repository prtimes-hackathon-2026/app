import type {
  FactsHitCurve,
  FactsPeriodCurve,
  FactsRelease,
  FactsResumeSegment,
  FactsTrends,
  FactsUnusedFeature,
} from './facts'

/**
 * 1 ターンの提示物。
 *
 * 「質問だけのターンを作らない」を守るため、blocks は必ず 1 つ以上入る。
 * 数値は blocks の中にしか無く、narrative は blocks を言い換えた文章でしかない。
 */

export type Evidence = {
  readonly companies: number
  readonly axes: readonly string[]
  readonly source: 'mock' | 'measured'
}

export type Block =
  | {
      readonly kind: 'diagnosis'
      readonly title: string
      readonly totalReleases: number
      readonly stoppedMonths: number | null
      readonly lastReleasedAt: Date | null
      readonly recent: readonly FactsRelease[]
    }
  | {
      readonly kind: 'hit_curve'
      readonly title: string
      readonly curve: FactsHitCurve
      readonly mine: string
      readonly evidence: Evidence
    }
  | {
      readonly kind: 'resume'
      readonly title: string
      readonly segment: FactsResumeSegment
      readonly gaps: readonly {
        readonly gap: string
        readonly companies: number
      }[]
      readonly totalResumed: number
    }
  | {
      readonly kind: 'unused_features'
      readonly title: string
      readonly items: readonly FactsUnusedFeature[]
    }
  | {
      readonly kind: 'outlook'
      readonly title: string
      readonly now: number
      readonly currentPct: number | null
      readonly steps: readonly OutlookStep[]
      readonly resumeTarget: FactsResumeSegment | null
    }
  | {
      readonly kind: 'period'
      readonly title: string
      readonly curve: FactsPeriodCurve
    }
  | {
      readonly kind: 'trends'
      readonly title: string
      readonly trends: FactsTrends
    }
  | {
      readonly kind: 'features'
      readonly title: string
      readonly items: readonly {
        readonly key: string
        readonly name: string
        readonly note: string
      }[]
      readonly articles: readonly {
        readonly title: string
        readonly url: string
      }[]
    }
  | {
      readonly kind: 'next_step'
      readonly title: string
      readonly action: string
      readonly detail: string
    }

/** 「あと何本でどこまで上がるか」を配信ペースに換算したもの */
export type OutlookStep = {
  readonly target: number
  readonly need: number
  readonly hitPct: number
  /** 月 1 本ペースでかかる月数 */
  readonly monthsMonthly: number
  /** 3 か月に 1 本ペースでかかる月数 */
  readonly monthsQuarterly: number
}

export type Question = {
  readonly id: string
  readonly text: string
  readonly options: readonly { readonly id: string; readonly label: string }[]
}

/** LLM が言い換えた文章。落ちたときは source: 'template' でテンプレのまま出る */
export type Narrative = {
  readonly text: Readonly<Record<string, string>>
  readonly source: 'llm' | 'template'
}

export type TurnNumber = 0 | 1 | 2

export type Turn = {
  readonly turn: TurnNumber
  readonly blocks: readonly Block[]
  readonly narrative: Narrative
  /** 終端 (ターン 2) では null */
  readonly question: Question | null
}
