/**
 * 統計 DB から取り出す実測値。ここに載る数字はすべて SQL が算出したもので、
 * LLM が作った数字は一つも含めない。
 *
 * 実データで分かっていること（情報通信・22,748社 / 756,600本で検証）:
 *  ・配信本数を重ねても 1本あたりの PV 中央値は伸びない（13 → 12）
 *  ・一方で PV の裾が極端に長い（中央値25 / 上位1% 1,487）
 *  ・つまり 1本ごとが「くじ」で、本数がそのまま当たりを引く確率になる
 *  ・メディア転載はほぼ全リリースで起きるため、転載率では差がつかない
 */

/** その企業の現在地 */
export type Diagnosis = {
  companyId: number
  companyName: string
  industryId: number
  industryName: string
  /** 事業内容。提案をその会社の商品に寄せるために使う */
  description: string
  totalReleases: number
  lastReleasedAt: Date | null
  /** 最終配信からの経過月数 */
  stoppedMonths: number | null
  /** 直近のリリース。実際の見出しを会話に出すために使う */
  recentTitles: readonly string[]
}

/** 配信本数別に「手応えのある結果」に届いた企業の割合 */
export type HitCurve = {
  buckets: readonly { bucket: string; companies: number; hitPct: number }[]
  /** 「手応えのある結果」の基準（業種内 PV 上位10%） */
  thresholdPv: number
  totalCompanies: number
}

/** 一度止まってから再開した企業。「もう一度やってみよう」を支える唯一の材料 */
export type ResumeSegment = {
  /** 休止前の配信本数の範囲 */
  fromN: number
  toN: number
  companies: number
  hitBeforePct: number
  hitAfterPct: number
  /** 再開後に追加した本数の中央値。これがそのまま目標になる */
  addedMedian: number
}

/** 経過期間で見た場合。本数で見た伸びとの対比に使う */
export type PeriodPoint = {
  months: number
  companies: number
  hitPct: number
  releasesMedian: number
}

/** リリース種別ごとの跳ねやすさ */
export type TypeTrend = {
  name: string
  n: number
  pvP50: number | null
  /** 跳ねたときの水準。中央値では差がつかないのでこちらを見る */
  pvP90: number | null
}

/** 打ち手ごとの差。相関であって因果ではない点に注意 */
export type Lever = {
  key:
    | 'main_image'
    | 'keyword'
    | 'title_number'
    | 'title_bracket'
    | 'location'
    | 'category'
  label: string
  withPct: number
  withoutPct: number
  ratio: number
  samples: number
}

/** 短期でどこまで届くか。「急ぐなら別の手段」を言い切らずに示す材料 */
export type Achievement = {
  companies: number
  avgReleases: number
  pct50: number
  pct200: number
  pct1000: number
}

/** その企業がまだ使っていない機能 */
export type UnusedFeature = {
  key: Lever['key']
  label: string
  detected: string
}

export type Insight = {
  diagnosis: Diagnosis
  hitCurve: HitCurve | null
  resume: ResumeSegment | null
  period: readonly PeriodPoint[]
  trends: readonly TypeTrend[]
  levers: readonly Lever[]
  achievement: Achievement | null
  unused: readonly UnusedFeature[]
}

/** 配信本数を、当たり率カーブのどの区分に置くか */
export function bucketOf(n: number): string {
  if (n <= 1) return '1本'
  if (n === 2) return '2本'
  if (n === 3) return '3本'
  if (n <= 5) return '4〜5本'
  if (n <= 10) return '6〜10本'
  if (n <= 20) return '11〜20本'
  return '21本以上'
}
