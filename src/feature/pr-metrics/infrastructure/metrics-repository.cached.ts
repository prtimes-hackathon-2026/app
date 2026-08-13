import 'server-only'

import { z } from 'zod'

import { bucketLabels } from '../domain/bucket'
import type { IndustryMetrics } from '../domain/metrics'
import type {
  IndustryMetricsCache,
  MetricsRepository,
} from '../domain/metrics-repository'

/**
 * 業種単位の 5 指標だけをキャッシュ越しにする MetricsRepository。
 *
 * キャッシュを application に持たせると、application が「重いかどうか」という
 * 実装都合を知ることになる。ここで包んでおけば、呼び出し側は 5 本を素直に
 * 並行で引くだけでよく、合成ルート (index.ts) で外すこともできる。
 *
 * 5 指標をまとめて 1 行に入れるのは、どれか 1 本だけ新しいという状態を作らないため。
 * 当たり率カーブと期間カーブは対にして初めて意味を持つ (設計 §5) ので、
 * 別々の時点で計算された値を並べてはいけない。
 */

/**
 * キャッシュから読んだ JSON を検証する。
 *
 * 型を変えたあとの古い行を素通しすると、実行時に「数字が入っているはずの場所が
 * undefined」という壊れ方をする。検証に落ちたら未ヒット扱いにして計算し直す。
 */
const leverSchema = z.object({
  on: z.object({ n: z.number(), hitPct: z.number() }),
  off: z.object({ n: z.number(), hitPct: z.number() }),
  ratio: z.number().nullable(),
})

const industryMetricsSchema = z.object({
  industryId: z.number(),
  hitCurve: z
    .object({
      buckets: z.array(
        z.object({
          bucket: z.enum(bucketLabels),
          companies: z.number(),
          hitPct: z.number(),
        }),
      ),
      thresholdPv: z.number(),
      totalCompanies: z.number(),
    })
    .nullable(),
  periodCurve: z
    .object({
      rows: z.array(
        z.object({
          months: z.number(),
          companies: z.number(),
          hitPct: z.number(),
          releasesP50: z.number(),
          cumPvP50: z.number(),
          cumPvP90: z.number(),
        }),
      ),
    })
    .nullable(),
  trends: z.object({
    items: z.array(
      z.object({
        releaseTypeName: z.string(),
        n: z.number(),
        pvP50: z.number().nullable(),
        pvP90: z.number().nullable(),
      }),
    ),
  }),
  resume: z
    .object({
      segments: z.array(
        z.object({
          seg: z.number(),
          fromN: z.number(),
          toN: z.number(),
          companies: z.number(),
          hitBeforePct: z.number(),
          hitAfterPct: z.number(),
          addedP50: z.number(),
        }),
      ),
      gaps: z.array(z.object({ gap: z.string(), companies: z.number() })),
      totalResumed: z.number(),
    })
    .nullable(),
  levers: z.object({
    main_image: leverSchema.optional(),
    keyword: leverSchema.optional(),
    title_number: leverSchema.optional(),
    title_bracket: leverSchema.optional(),
  }),
})

function parseCached(value: unknown): IndustryMetrics | null {
  const parsed = industryMetricsSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function cachedMetricsRepository(
  base: MetricsRepository,
  cache: IndustryMetricsCache,
): MetricsRepository {
  /**
   * 同じ業種の 5 指標は同時に要求される。そのまま流すと同じ集計が 5 本走るため、
   * 進行中の計算をプロセス内で 1 つにまとめる (タスクをまたぐ共有はキャッシュ側の仕事)。
   */
  const inFlight = new Map<number, Promise<IndustryMetrics>>()

  async function compute(industryId: number): Promise<IndustryMetrics> {
    const hit = await cache.get(industryId)
    const cached = hit && parseCached(hit.metrics)
    if (cached) return cached

    const [hitCurve, periodCurve, trends, resume, levers] = await Promise.all([
      base.findHitCurve(industryId),
      base.findPeriodCurve(industryId),
      base.findTrends(industryId),
      base.findResumeStats(industryId),
      base.findLevers(industryId),
    ])

    const metrics: IndustryMetrics = {
      industryId,
      hitCurve,
      periodCurve,
      trends,
      resume,
      levers,
    }

    // 保存に失敗しても指標そのものは返せる。次の参照で計算し直すだけなので、
    // キャッシュの書き込み失敗で対話を止めない
    await cache.set(industryId, metrics).catch(() => undefined)

    return metrics
  }

  function load(industryId: number): Promise<IndustryMetrics> {
    const running = inFlight.get(industryId)
    if (running) return running

    const pending = compute(industryId).finally(() => {
      inFlight.delete(industryId)
    })
    inFlight.set(industryId, pending)
    return pending
  }

  return {
    // 企業単位の 3 本は軽いのでキャッシュしない (毎回最新を出す)
    findCompany: (companyId) => base.findCompany(companyId),
    findHistory: (companyId) => base.findHistory(companyId),
    findFeatureUsage: (companyId) => base.findFeatureUsage(companyId),

    findHitCurve: async (industryId) => (await load(industryId)).hitCurve,
    findPeriodCurve: async (industryId) => (await load(industryId)).periodCurve,
    findTrends: async (industryId) => (await load(industryId)).trends,
    findResumeStats: async (industryId) => (await load(industryId)).resume,
    findLevers: async (industryId) => (await load(industryId)).levers,

    findStoppedCompanies: (limit) => base.findStoppedCompanies(limit),
  }
}
