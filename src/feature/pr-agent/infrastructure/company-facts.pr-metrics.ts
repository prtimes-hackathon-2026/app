import 'server-only'

import { prMetricsFeature } from '@/feature/pr-metrics'

import type {
  CompanyFactsPort,
  CompanyFactsSnapshot,
  FactsHitCurve,
  FactsPeriodCurve,
  FactsRelease,
  FactsResume,
  FactsTrends,
  FactsUnusedFeature,
} from '../domain/facts'

/**
 * 事実の取得。pr-metrics の公開 API だけを呼ぶ。
 *
 * pr-metrics は SQL を持つ側で、指標の定義もそちらにある。
 * pr-agent の domain / application はその型を知らないので、変換はここで閉じる。
 */

/**
 * 公開 API の戻り値。型名を書かずに戻り値から引いているのは、
 * pr-metrics がどの名前で公開するかに、こちら側が縛られないようにするため。
 */
type Bundle = NonNullable<
  Awaited<ReturnType<typeof prMetricsFeature.getCompanyFacts>>
>

/**
 * 構造はほぼ一致するので実体は恒等変換に近いが、フィールドを明示して詰め替える。
 * スプレッドで通すと、片方の構造が変わったときに型が合わないまま素通りしてしまう。
 * ずれたらここでコンパイルが落ちてほしい。
 */
function toRelease(release: Bundle['history']['recent'][number]): FactsRelease {
  return {
    title: release.title,
    releasedAt: release.releasedAt,
    pageView: release.pageView,
  }
}

function toHitCurve(curve: NonNullable<Bundle['hitCurve']>): FactsHitCurve {
  return {
    buckets: curve.buckets.map((bucket) => ({
      bucket: bucket.bucket,
      companies: bucket.companies,
      hitPct: bucket.hitPct,
    })),
    thresholdPv: curve.thresholdPv,
    totalCompanies: curve.totalCompanies,
  }
}

function toPeriodCurve(
  curve: NonNullable<Bundle['periodCurve']>,
): FactsPeriodCurve {
  return {
    rows: curve.rows.map((row) => ({
      months: row.months,
      companies: row.companies,
      hitPct: row.hitPct,
      releasesP50: row.releasesP50,
      cumPvP50: row.cumPvP50,
      cumPvP90: row.cumPvP90,
    })),
  }
}

function toTrends(trends: Bundle['trends']): FactsTrends {
  return {
    items: trends.items.map((item) => ({
      releaseTypeName: item.releaseTypeName,
      n: item.n,
      pvP50: item.pvP50,
      pvP90: item.pvP90,
    })),
  }
}

function toResume(resume: NonNullable<Bundle['resume']>): FactsResume {
  const segment = resume.segment
  return {
    segment: segment
      ? {
          fromN: segment.fromN,
          toN: segment.toN,
          companies: segment.companies,
          hitBeforePct: segment.hitBeforePct,
          hitAfterPct: segment.hitAfterPct,
          addedP50: segment.addedP50,
        }
      : null,
    gaps: resume.gaps.map((gap) => ({
      gap: gap.gap,
      companies: gap.companies,
    })),
    totalResumed: resume.totalResumed,
  }
}

function toUnusedFeature(
  feature: Bundle['unused'][number],
): FactsUnusedFeature {
  const impact = feature.impact
  return {
    key: feature.key,
    label: feature.label,
    detected: feature.detected,
    impact: impact
      ? {
          withPct: impact.withPct,
          withoutPct: impact.withoutPct,
          ratio: impact.ratio,
          n: impact.n,
        }
      : null,
  }
}

function toSnapshot(bundle: Bundle): CompanyFactsSnapshot {
  return {
    company: {
      companyId: bundle.company.companyId,
      companyName: bundle.company.companyName,
      industryId: bundle.company.industryId,
      industryName: bundle.company.industryName,
      description: bundle.company.description,
    },
    history: {
      totalReleases: bundle.history.totalReleases,
      lastReleasedAt: bundle.history.lastReleasedAt,
      stoppedMonths: bundle.history.stoppedMonths,
      recent: bundle.history.recent.map(toRelease),
    },
    bucket: bundle.bucket,
    hitCurve: bundle.hitCurve ? toHitCurve(bundle.hitCurve) : null,
    periodCurve: bundle.periodCurve ? toPeriodCurve(bundle.periodCurve) : null,
    trends: toTrends(bundle.trends),
    resume: bundle.resume ? toResume(bundle.resume) : null,
    unused: bundle.unused.map(toUnusedFeature),
    // 模擬データか実データかはコードが付ける。LLM には書かせない
    source: bundle.source,
  }
}

export function prMetricsCompanyFacts(): CompanyFactsPort {
  return {
    async load(companyId) {
      const bundle = await prMetricsFeature.getCompanyFacts(companyId)
      return bundle ? toSnapshot(bundle) : null
    },
  }
}
