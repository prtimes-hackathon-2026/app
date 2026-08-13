import 'server-only'

import { eq, sql } from 'drizzle-orm'

import { appDb, appSchema } from '@/external/db/app'

import type { IndustryMetricsCache } from '../domain/metrics-repository'

/**
 * 業種単位の指標を app DB に置いてタスク間で共有する (設計 §5)。
 *
 * TTL は 30 分。プロトタイプのプロセス内キャッシュと同じ値で、
 * 「1 回の対話 (3 ターン) の間に再計算が走らない」ことだけを保証すれば足りるため。
 * 元データは日次で積み上がる配信実績なので、数十分古くても提示する数字は変わらない。
 */
const ttlMs = 30 * 60 * 1000

export function drizzleIndustryMetricsCache(): IndustryMetricsCache {
  return {
    async get(industryId) {
      const rows = await appDb()
        .select()
        .from(appSchema.prIndustryMetrics)
        .where(eq(appSchema.prIndustryMetrics.industryId, industryId))
        .limit(1)

      const row = rows[0]
      if (!row) return null

      // 期限切れは行を消さずに未ヒット扱いにする。消してから計算に失敗すると
      // 古いなりに使えた値まで失うため、上書きは set() の成功時だけにする
      if (Date.now() - row.computedAt.getTime() >= ttlMs) return null

      return { metrics: row.metrics, computedAt: row.computedAt }
    },

    async set(industryId, metrics) {
      await appDb()
        .insert(appSchema.prIndustryMetrics)
        .values({ industryId, metrics })
        .onConflictDoUpdate({
          target: appSchema.prIndustryMetrics.industryId,
          set: { metrics, computedAt: sql`now()` },
        })
    },
  }
}
