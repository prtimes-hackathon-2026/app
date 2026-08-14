import 'server-only'

import { sql } from 'drizzle-orm'

import { statsDb } from '@/external/db/stats'

import type {
  Achievement,
  Diagnosis,
  HitCurve,
  Insight,
  Lever,
  PeriodPoint,
  ResumeSegment,
  TypeTrend,
  UnusedFeature,
} from '../domain/insight'
import type { InsightRepository } from '../domain/insight-repository'

/**
 * 統計 DB は参照専用。集計は業種単位で重い（種別ごとの傾向で約9秒、
 * 打ち手の差分で約30秒）ので、業種ごとに結果を持ち回る。
 * release_statistic と webclipping_list にインデックスが無いため、
 * 大量結合を避ける形にしてある。
 */
const INDUSTRY_TTL_MS = 24 * 60 * 60 * 1000
const COMPANY_TTL_MS = 60 * 1000
const cache = new Map<string, { at: number; value: unknown }>()
const inFlight = new Map<string, Promise<unknown>>()

async function cached<T>(
  key: string,
  load: () => Promise<T>,
  ttlMs = INDUSTRY_TTL_MS,
): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttlMs) {
    console.info(
      '[pr-compass:cache]',
      JSON.stringify({ key, status: 'hit', durationMs: 0 }),
    )
    return hit.value as T
  }

  const pending = inFlight.get(key)
  if (pending) {
    console.info(
      '[pr-compass:cache]',
      JSON.stringify({ key, status: 'in-flight', durationMs: 0 }),
    )
    return pending as Promise<T>
  }

  const startedAt = performance.now()
  const request = load()
    .then((value) => {
      cache.set(key, { at: Date.now(), value })
      console.info(
        '[pr-compass:cache]',
        JSON.stringify({
          key,
          status: 'miss',
          durationMs: Math.round(performance.now() - startedAt),
        }),
      )
      return value
    })
    .finally(() => inFlight.delete(key))

  inFlight.set(key, request)
  return request
}

const num = (v: unknown): number => Number(v ?? 0)
const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v)

async function rows<T = Record<string, unknown>>(
  query: ReturnType<typeof sql>,
): Promise<T[]> {
  // postgres-js ドライバは配列そのものを返す。
  // 他ドライバ（{ rows } を返すもの）に差し替わっても壊れないよう吸収する
  const result: unknown = await statsDb().execute(query)
  if (Array.isArray(result)) return result as T[]
  const maybe = (result as { rows?: unknown }).rows
  return (Array.isArray(maybe) ? maybe : []) as T[]
}

// ─────────────────────────────────────────── 現在地

function loadDiagnosis(companyId: number): Promise<Diagnosis | null> {
  return cached(
    `diagnosis:${companyId}`,
    async () => {
      // 会社・配信集計・直近タイトルを1往復で取得する。以前は3クエリを直列実行していた。
      const [company] = await rows(sql`
        SELECT c.company_id, c.company_name, c.industry_id,
               COALESCE(i.industry_name, '') AS industry_name,
               LEFT(COALESCE(c.description, ''), 300) AS description,
               COALESCE(r.total, 0)::int AS total,
               r.last_at,
               COALESCE(r.recent_titles, ARRAY[]::text[]) AS recent_titles
          FROM company c
          LEFT JOIN industry i ON i.industry_id = c.industry_id
          LEFT JOIN LATERAL (
            SELECT COUNT(*)::int AS total,
                   MAX(release.created_at) AS last_at,
                   ARRAY(
                     SELECT recent.title
                       FROM release recent
                      WHERE recent.company_id = c.company_id
                      ORDER BY recent.created_at DESC
                      LIMIT 3
                   ) AS recent_titles
              FROM release
             WHERE release.company_id = c.company_id
          ) r ON TRUE
         WHERE c.company_id = ${companyId}
      `)
      if (!company) return null

      const lastAt = company.last_at ? new Date(String(company.last_at)) : null
      const recentTitles = Array.isArray(company.recent_titles)
        ? company.recent_titles.map(String).filter(Boolean)
        : []

      return {
        companyId: num(company.company_id),
        companyName: String(company.company_name ?? ''),
        industryId: num(company.industry_id),
        industryName: String(company.industry_name ?? ''),
        description: String(company.description ?? ''),
        totalReleases: num(company.total),
        lastReleasedAt: lastAt,
        stoppedMonths: lastAt
          ? Math.max(
              0,
              Math.round(
                (Date.now() - lastAt.getTime()) / (1000 * 60 * 60 * 24 * 30.4),
              ),
            )
          : null,
        recentTitles,
      }
    },
    COMPANY_TTL_MS,
  )
}

// ─────────────────────────────────────────── 当たり率カーブ（中心指標）

function loadHitCurve(industryId: number): Promise<HitCurve | null> {
  return cached(`hit:${industryId}`, async () => {
    const result = await rows(sql`
      WITH peers AS (SELECT company_id FROM company WHERE industry_id = ${industryId}),
      rel AS (
        SELECT r.company_id, COALESCE(s.page_view, 0) AS pv
          FROM release r
          JOIN peers p ON p.company_id = r.company_id
          LEFT JOIN release_statistic s
                 ON s.company_id = r.company_id AND s.release_id = r.release_id
      ),
      thr AS (SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY pv) AS t FROM rel),
      comp AS (
        SELECT company_id, COUNT(*) AS n,
               MAX(CASE WHEN pv >= (SELECT t FROM thr) THEN 1 ELSE 0 END) AS hit
          FROM rel GROUP BY 1
      )
      SELECT CASE WHEN n = 1 THEN '1本' WHEN n = 2 THEN '2本' WHEN n = 3 THEN '3本'
                  WHEN n <= 5 THEN '4〜5本' WHEN n <= 10 THEN '6〜10本'
                  WHEN n <= 20 THEN '11〜20本' ELSE '21本以上' END AS bucket,
             COUNT(*)::int AS companies,
             ROUND(AVG(hit) * 100)::int AS hit_pct,
             (SELECT ROUND(t)::int FROM thr) AS threshold_pv
        FROM comp GROUP BY 1 ORDER BY MIN(n)
    `)
    if (!result.length) return null
    return {
      buckets: result.map((r) => ({
        bucket: String(r.bucket),
        companies: num(r.companies),
        hitPct: num(r.hit_pct),
      })),
      thresholdPv: num(result[0]?.threshold_pv),
      totalCompanies: result.reduce((a, r) => a + num(r.companies), 0),
    }
  })
}

// ─────────────────────────────────────────── 再開した企業

type ResumeRow = {
  seg?: unknown
  from_n?: unknown
  to_n?: unknown
  companies?: unknown
  hit_before_pct?: unknown
  hit_after_pct?: unknown
  added_p50?: unknown
}

function loadResumeRows(industryId: number): Promise<ResumeRow[]> {
  return cached(`resume:${industryId}`, () =>
    rows<ResumeRow>(sql`
      WITH peers AS (SELECT company_id FROM company WHERE industry_id = ${industryId}),
      rel AS (
        SELECT r.company_id, r.created_at, COALESCE(s.page_view, 0) AS pv
          FROM release r
          JOIN peers p ON p.company_id = r.company_id
          LEFT JOIN release_statistic s
                 ON s.company_id = r.company_id AND s.release_id = r.release_id
      ),
      thr AS (SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY pv) AS t FROM rel),
      g AS (
        SELECT company_id, created_at, pv,
               LAG(created_at) OVER (PARTITION BY company_id ORDER BY created_at) AS prev
          FROM rel
      ),
      resume AS (
        SELECT company_id, MIN(created_at) AS resume_at
          FROM g
         WHERE prev IS NOT NULL AND created_at - prev > INTERVAL '6 months'
         GROUP BY 1
      ),
      after AS (
        SELECT r.company_id, COUNT(*)::int AS n_after,
               MAX(CASE WHEN r.pv >= (SELECT t FROM thr) THEN 1 ELSE 0 END) AS hit_after
          FROM rel r JOIN resume s ON s.company_id = r.company_id
         WHERE r.created_at >= s.resume_at GROUP BY 1
      ),
      before AS (
        SELECT r.company_id, COUNT(*)::int AS n_before,
               MAX(CASE WHEN r.pv >= (SELECT t FROM thr) THEN 1 ELSE 0 END) AS hit_before
          FROM rel r JOIN resume s ON s.company_id = r.company_id
         WHERE r.created_at < s.resume_at GROUP BY 1
      )
      SELECT CASE WHEN b.n_before = 1 THEN 1 WHEN b.n_before <= 3 THEN 2
                  WHEN b.n_before <= 10 THEN 3 ELSE 4 END AS seg,
             MIN(b.n_before)::int AS from_n, MAX(b.n_before)::int AS to_n,
             COUNT(*)::int AS companies,
             ROUND(AVG(b.hit_before) * 100)::int AS hit_before_pct,
             ROUND(AVG(a.hit_after) * 100)::int AS hit_after_pct,
             PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY a.n_after)::int AS added_p50
        FROM before b JOIN after a ON a.company_id = b.company_id
       GROUP BY 1 ORDER BY 1
    `),
  )
}

async function loadResume(
  industryId: number,
  totalReleases: number,
): Promise<ResumeSegment | null> {
  const result = await loadResumeRows(industryId)
  if (!result.length) return null

  const wanted =
    totalReleases <= 1
      ? 1
      : totalReleases <= 3
        ? 2
        : totalReleases <= 10
          ? 3
          : 4
  const row = result.find((r) => num(r.seg) === wanted) ?? result[0]
  if (!row) return null

  return {
    fromN: num(row.from_n),
    toN: num(row.to_n),
    companies: num(row.companies),
    hitBeforePct: num(row.hit_before_pct),
    hitAfterPct: num(row.hit_after_pct),
    addedMedian: num(row.added_p50),
  }
}

// ─────────────────────────────────────────── 期間で見た場合

function loadPeriod(industryId: number): Promise<PeriodPoint[]> {
  return cached(`period:${industryId}`, async () => {
    const result = await rows(sql`
      WITH peers AS (SELECT company_id FROM company WHERE industry_id = ${industryId}),
      rel AS (
        SELECT r.company_id, r.created_at, COALESCE(s.page_view, 0) AS pv
          FROM release r
          JOIN peers p ON p.company_id = r.company_id
          LEFT JOIN release_statistic s
                 ON s.company_id = r.company_id AND s.release_id = r.release_id
      ),
      thr AS (SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY pv) AS t FROM rel),
      base AS (SELECT company_id, MIN(created_at) AS first_at FROM rel GROUP BY 1),
      win AS (
        SELECT b.company_id, m.months,
               COUNT(*) FILTER (
                 WHERE r.created_at < b.first_at + (m.months || ' months')::interval)::int AS n,
               MAX(CASE WHEN r.created_at < b.first_at + (m.months || ' months')::interval
                         AND r.pv >= (SELECT t FROM thr) THEN 1 ELSE 0 END) AS hit
          FROM base b
          JOIN rel r ON r.company_id = b.company_id
          CROSS JOIN (VALUES (3),(12),(36)) AS m(months)
         -- 観測期間が足りない企業は除外して打ち切りバイアスを避ける
         WHERE b.first_at + (m.months || ' months')::interval <= NOW()
         GROUP BY 1, 2
      )
      SELECT months::int, COUNT(*)::int AS companies,
             ROUND(AVG(hit) * 100)::int AS hit_pct,
             PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY n)::int AS releases_p50
        FROM win GROUP BY months ORDER BY months
    `)
    return result.map((r) => ({
      months: num(r.months),
      companies: num(r.companies),
      hitPct: num(r.hit_pct),
      releasesMedian: num(r.releases_p50),
    }))
  })
}

// ─────────────────────────────────────────── 種別ごとの傾向

function loadTrends(industryId: number): Promise<TypeTrend[]> {
  return cached(`trend:${industryId}`, async () => {
    const result = await rows(sql`
      WITH peers AS (SELECT company_id FROM company WHERE industry_id = ${industryId})
      SELECT COALESCE(TRIM(rt.release_type_name), '不明') AS name,
             COUNT(*)::int AS n,
             PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.page_view)::int AS pv_p50,
             PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY s.page_view)::int AS pv_p90
        FROM release r
        JOIN peers p ON p.company_id = r.company_id
        LEFT JOIN release_type rt ON rt.release_type_id = r.release_type_id
        LEFT JOIN release_statistic s
               ON s.company_id = r.company_id AND s.release_id = r.release_id
       GROUP BY 1 HAVING COUNT(*) >= 500
       ORDER BY pv_p90 DESC NULLS LAST LIMIT 7
    `)
    return result.map((r) => ({
      name: String(r.name),
      n: num(r.n),
      pvP50: numOrNull(r.pv_p50),
      pvP90: numOrNull(r.pv_p90),
    }))
  })
}

// ─────────────────────────────────────────── 打ち手ごとの差

const LEVER_LABELS: Record<Lever['key'], string> = {
  main_image: 'メイン画像',
  keyword: 'キーワード設定',
  title_number: 'タイトルに数字を入れる',
  title_bracket: 'タイトルの【】',
  location: '地域指定',
  category: 'カテゴリ設定',
}

function loadLevers(industryId: number): Promise<Lever[]> {
  return cached(`lever:${industryId}`, async () => {
    const result = await rows(sql`
      WITH peers AS (SELECT company_id FROM company WHERE industry_id = ${industryId}),
      rel AS (
        SELECT r.company_id, r.release_id, r.title, r.main_image,
               COALESCE(s.page_view, 0) AS pv
          FROM release r
          JOIN peers p ON p.company_id = r.company_id
          LEFT JOIN release_statistic s
                 ON s.company_id = r.company_id AND s.release_id = r.release_id
      ),
      thr AS (SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY pv) AS t FROM rel),
      kw AS (
        SELECT k.company_id, k.release_id, COUNT(*) AS cnt
          FROM release_keyword k
          JOIN rel ON rel.company_id = k.company_id AND rel.release_id = k.release_id
         GROUP BY 1, 2
      ),
      flat AS (
        SELECT 'main_image' AS lever,
               CASE WHEN rel.main_image IS NULL OR rel.main_image = '' THEN 'off' ELSE 'on' END AS variant,
               rel.pv FROM rel
        UNION ALL
        SELECT 'keyword',
               CASE WHEN COALESCE(kw.cnt, 0) >= 3 THEN 'on' ELSE 'off' END, rel.pv
          FROM rel LEFT JOIN kw
            ON kw.company_id = rel.company_id AND kw.release_id = rel.release_id
        UNION ALL
        SELECT 'title_number',
               CASE WHEN rel.title ~ '[0-9０-９]' THEN 'on' ELSE 'off' END, rel.pv FROM rel
        UNION ALL
        SELECT 'location',
               CASE WHEN lo.release_id IS NULL THEN 'off' ELSE 'on' END, rel.pv
          FROM rel LEFT JOIN (SELECT DISTINCT company_id, release_id FROM release_location) lo
            ON lo.company_id = rel.company_id AND lo.release_id = rel.release_id
        UNION ALL
        -- カテゴリは「増やす」ことに意味が無い（1件10.9% / 2件10.2%）。
        -- 効くのは 0→1 だけ（0.4% → 10.9%）なので、有無だけで見る
        SELECT 'category',
               CASE WHEN ca.release_id IS NULL THEN 'off' ELSE 'on' END, rel.pv
          FROM rel LEFT JOIN (SELECT DISTINCT company_id, release_id
                                FROM release_business_category) ca
            ON ca.company_id = rel.company_id AND ca.release_id = rel.release_id
      )
      SELECT lever, variant, COUNT(*)::int AS n,
             ROUND(AVG(CASE WHEN pv >= (SELECT t FROM thr) THEN 1.0 ELSE 0 END) * 100, 1)::float AS hit_pct
        FROM flat GROUP BY 1, 2
    `)

    const grouped = new Map<string, { on?: number; off?: number; n: number }>()
    for (const r of result) {
      const key = String(r.lever)
      const cur = grouped.get(key) ?? { n: 0 }
      if (String(r.variant) === 'on') cur.on = num(r.hit_pct)
      else cur.off = num(r.hit_pct)
      cur.n += num(r.n)
      grouped.set(key, cur)
    }

    const levers: Lever[] = []
    for (const [key, v] of grouped) {
      if (v.on === undefined || v.off === undefined || v.off <= 0) continue
      levers.push({
        key: key as Lever['key'],
        label: LEVER_LABELS[key as Lever['key']] ?? key,
        withPct: v.on,
        withoutPct: v.off,
        ratio: Math.round((v.on / v.off) * 10) / 10,
        samples: v.n,
      })
    }
    return levers.sort((a, b) => b.ratio - a.ratio)
  })
}

// ─────────────────────────────────────────── 短期の達成率

function loadAchievement(industryId: number): Promise<Achievement | null> {
  return cached(`achieve:${industryId}`, async () => {
    const [row] = await rows(sql`
      WITH peers AS (SELECT company_id FROM company WHERE industry_id = ${industryId}),
      base AS (
        SELECT r.company_id, MIN(r.created_at) AS first_at
          FROM release r JOIN peers p ON p.company_id = r.company_id
         GROUP BY 1
      ),
      w AS (
        SELECT b.company_id, MAX(COALESCE(s.page_view, 0))::int AS best, COUNT(*)::int AS n
          FROM base b
          JOIN release r ON r.company_id = b.company_id
          LEFT JOIN release_statistic s
                 ON s.company_id = r.company_id AND s.release_id = r.release_id
         WHERE r.created_at < b.first_at + INTERVAL '3 months'
           AND b.first_at + INTERVAL '3 months' <= NOW()
         GROUP BY 1
      )
      SELECT COUNT(*)::int AS companies,
             ROUND(AVG(n), 1)::float AS avg_releases,
             ROUND(AVG(CASE WHEN best >=   50 THEN 1.0 ELSE 0 END) * 100, 1)::float AS pct_50,
             ROUND(AVG(CASE WHEN best >=  200 THEN 1.0 ELSE 0 END) * 100, 1)::float AS pct_200,
             ROUND(AVG(CASE WHEN best >= 1000 THEN 1.0 ELSE 0 END) * 100, 1)::float AS pct_1000
        FROM w
    `)
    if (!row) return null
    return {
      companies: num(row.companies),
      avgReleases: num(row.avg_releases),
      pct50: num(row.pct_50),
      pct200: num(row.pct_200),
      pct1000: num(row.pct_1000),
    }
  })
}

// ─────────────────────────────────────────── 使っていない機能

async function queryUnused(companyId: number): Promise<UnusedFeature[]> {
  const [f] = await rows(sql`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE main_image IS NULL OR main_image = '')::int AS no_image,
           COUNT(*) FILTER (WHERE title !~ '[0-9０-９]')::int AS no_number
      FROM release WHERE company_id = ${companyId}
  `)
  if (!f || num(f.total) === 0) return []
  const total = num(f.total)

  const [k] = await rows(sql`
    SELECT COALESCE(AVG(kw.cnt), 0)::float AS avg_keywords
      FROM release r
      LEFT JOIN (SELECT company_id, release_id, COUNT(*) AS cnt
                   FROM release_keyword GROUP BY 1, 2) kw
             ON kw.company_id = r.company_id AND kw.release_id = r.release_id
     WHERE r.company_id = ${companyId}
  `)

  const [c] = await rows(sql`
    SELECT COUNT(*)::int AS with_category
      FROM release r
      JOIN release_business_category b
        ON b.company_id = r.company_id AND b.release_id = r.release_id
     WHERE r.company_id = ${companyId}
  `)

  const out: UnusedFeature[] = []
  if (num(f.no_image) === total)
    out.push({ key: 'main_image', label: 'メイン画像', detected: '未設定' })
  if (num(k?.avg_keywords) < 3)
    out.push({
      key: 'keyword',
      label: 'キーワード設定',
      detected: `平均${num(k?.avg_keywords).toFixed(1)}件`,
    })
  // カテゴリは 0 件のときだけ指摘する。増やしても効果は変わらない
  if (num(c?.with_category) === 0)
    out.push({ key: 'category', label: 'カテゴリ設定', detected: '未設定' })
  if (num(f.no_number) === total)
    out.push({
      key: 'title_number',
      label: 'タイトルに数字を入れる',
      detected: '使っていない',
    })
  return out
}

function loadUnused(companyId: number): Promise<UnusedFeature[]> {
  return cached(
    `unused:${companyId}`,
    () => queryUnused(companyId),
    5 * 60 * 1000,
  )
}

// ─────────────────────────────────────────── 合成

async function loadIndustryMetrics(diagnosis: Diagnosis) {
  const industryId = diagnosis.industryId
  const [hitCurve, resume, period, trends, levers, achievement] =
    await Promise.all([
      loadHitCurve(industryId),
      loadResume(industryId, diagnosis.totalReleases),
      loadPeriod(industryId),
      loadTrends(industryId),
      loadLevers(industryId),
      loadAchievement(industryId),
    ])

  return { hitCurve, resume, period, trends, levers, achievement }
}

function initialInsight(diagnosis: Diagnosis): Insight {
  return {
    diagnosis,
    hitCurve: null,
    resume: null,
    period: [],
    trends: [],
    levers: [],
    achievement: null,
    unused: [],
  }
}

export function drizzleInsightRepository(): InsightRepository {
  return {
    async load(companyId, mode = 'full') {
      const startedAt = performance.now()
      const diagnosis = await loadDiagnosis(companyId)
      if (!diagnosis) return null

      const diagnosisMs = Math.round(performance.now() - startedAt)
      if (mode === 'initial') {
        // 初回レスポンスは企業固有の現在地だけで返す。同業集計は同じプロセスで
        // 先に温め、次の発言時には進行中のPromiseまたはキャッシュを共有する。
        void loadIndustryMetrics(diagnosis).catch((error) =>
          console.error('[pr-compass:warmup]', error),
        )
        console.info(
          '[pr-compass:insights]',
          JSON.stringify({
            companyId,
            industryId: diagnosis.industryId,
            mode,
            diagnosisMs,
            totalMs: Math.round(performance.now() - startedAt),
            warmup: 'started',
          }),
        )
        return initialInsight(diagnosis)
      }

      const [
        { hitCurve, resume, period, trends, levers, achievement },
        unused,
      ] = await Promise.all([
        loadIndustryMetrics(diagnosis),
        loadUnused(companyId),
      ])

      const insight = {
        diagnosis,
        hitCurve,
        resume,
        period,
        trends,
        levers,
        achievement,
        unused,
      } satisfies Insight

      console.info(
        '[pr-compass:insights]',
        JSON.stringify({
          companyId,
          industryId: diagnosis.industryId,
          mode,
          diagnosisMs,
          totalMs: Math.round(performance.now() - startedAt),
        }),
      )
      return insight
    },
  }
}
