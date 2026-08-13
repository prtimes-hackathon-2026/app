import { bucketOf } from '../domain/bucket'
import type {
  CompanyFactsBundle,
  FactsSource,
} from '../domain/company-facts-bundle'
import { resumeSegmentFor, type Levers, type Trends } from '../domain/metrics'
import type { MetricsRepository } from '../domain/metrics-repository'
import { detectUnusedFeatures } from '../domain/unused-feature'

export type GetCompanyFacts = (
  companyId: number,
) => Promise<CompanyFactsBundle | null>

/**
 * 業種が分からない企業でも「現在地」だけは返せるようにするための空値。
 * 業種単位の指標は照合軸が業種しか無い (設計 §1) ので、業種が無ければ何も出せない。
 */
const noTrends: Trends = { items: [] }
const noLevers: Levers = {}

/**
 * 企業 ID から、対話に出す事実を一式そろえる。
 *
 * 数値と判定はここまでで確定させ、LLM には言い換えしかさせない (設計 §4)。
 * source を引数で受けるのは、模擬データか実データかを判断できるのが
 * 合成ルート (index.ts) だけであり、ここから環境変数を見に行けないため。
 */
export function getCompanyFacts(
  repository: MetricsRepository,
  source: FactsSource,
): GetCompanyFacts {
  return async (companyId) => {
    // 業種単位の指標は industryId が要るので、企業だけ先に引く
    const company = await repository.findCompany(companyId)
    if (!company) return null

    const { industryId } = company

    // 企業単位の 3 本は軽く、業種単位の 5 本は重い (業種全件スキャン)。
    // 直列に積むと重い側が待ち時間をそのまま足すため、まとめて並行に投げる。
    const [history, usage, hitCurve, periodCurve, trends, resume, levers] =
      await Promise.all([
        repository.findHistory(companyId),
        repository.findFeatureUsage(companyId),
        industryId === null ? null : repository.findHitCurve(industryId),
        industryId === null ? null : repository.findPeriodCurve(industryId),
        industryId === null ? noTrends : repository.findTrends(industryId),
        industryId === null ? null : repository.findResumeStats(industryId),
        industryId === null ? noLevers : repository.findLevers(industryId),
      ])

    const segment = resumeSegmentFor(history.totalReleases, resume)

    return {
      company: {
        companyId: company.companyId,
        companyName: company.companyName,
        industryId: company.industryId,
        industryName: company.industryName,
        description: company.description,
      },
      history: {
        totalReleases: history.totalReleases,
        lastReleasedAt: history.lastReleasedAt,
        stoppedMonths: history.stoppedMonths,
        recent: history.recent,
      },
      bucket: bucketOf(history.totalReleases),
      hitCurve,
      periodCurve,
      trends,
      resume: resume
        ? {
            // seg (セグメント番号) は選択に使うだけの内部値なので外へは出さない
            segment: segment && {
              fromN: segment.fromN,
              toN: segment.toN,
              companies: segment.companies,
              hitBeforePct: segment.hitBeforePct,
              hitAfterPct: segment.hitAfterPct,
              addedP50: segment.addedP50,
            },
            gaps: resume.gaps,
            totalResumed: resume.totalResumed,
          }
        : null,
      unused: detectUnusedFeatures(usage, levers),
      source,
    }
  }
}
