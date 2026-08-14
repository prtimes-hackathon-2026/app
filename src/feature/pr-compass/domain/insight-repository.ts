import type { Insight } from './insight'

export type InsightLoadMode = 'initial' | 'full'

export type InsightRepository = {
  /**
   * initial は初回表示に必要な企業の現在地だけを返す。
   * full は後続の提案に必要な同業の実測値まで一式そろえる。
   */
  load(companyId: number, mode?: InsightLoadMode): Promise<Insight | null>
}
