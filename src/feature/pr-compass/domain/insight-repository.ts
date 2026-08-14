import type { Insight } from './insight'

export type InsightRepository = {
  /** 対象企業の現在地と、同業の実測値を一式そろえる */
  load(companyId: number): Promise<Insight | null>
}
