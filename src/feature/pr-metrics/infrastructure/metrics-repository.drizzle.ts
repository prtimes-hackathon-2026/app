import 'server-only'

import { sql } from 'drizzle-orm'

import { statsDb } from '@/external/db/stats'

import { bucketLabels, type BucketLabel } from '../domain/bucket'
import type {
  CompanyHistory,
  CompanyProfile,
  FeatureUsage,
} from '../domain/company-position'
import type {
  HitCurve,
  Lever,
  LeverKey,
  Levers,
  PeriodCurve,
  ResumeStats,
  Trends,
} from '../domain/metrics'
import type {
  MetricsRepository,
  StoppedCompany,
} from '../domain/metrics-repository'

/**
 * PR TIMES DB からの読み取り。参照専用で、書き込みも DDL もしない。
 *
 * SQL は voice-agent プロトタイプ (voice-agent/src/metrics.js) からの移植。
 * あちらは実 RDS で動作確認済みで、仕様が食い違ったらプロトタイプを正とすると
 * 決まっている (設計 §1) ため、軽いクエリも含めて生の SQL のまま持ってきている。
 * クエリビルダに書き換えると移植元と一行ずつ突き合わせられなくなる。
 *
 * release_statistic / release_keyword の JOIN は必ず (company_id, release_id) の
 * 複合キーで行う。release_id 単独では一意にならず、他社のリリースを巻き込む。
 *
 * 業種単位の集計 (findHitCurve 以降) は CTE・ウィンドウ関数・PERCENTILE_CONT を
 * 使い、業種の全リリースを走査する。metrics-repository.cached.ts で
 * キャッシュを噛ませて呼ぶ前提であり、素で毎回叩くものではない。
 */

/** 停止期間の概算に使う 1 か月。プロトタイプと同じ 30.4 日 (暦月では数えない) */
const monthMs = 1000 * 60 * 60 * 24 * 30.4

/**
 * 生の SQL が返す時刻。ドライバの型パーサを通らず
 * '2025-11-13 16:50:16' のような文字列で来ることがある。
 */
type TimestampValue = Date | string | number | null | undefined

/**
 * 時刻を必ず Date にして境界の外へ出す。
 *
 * domain は Date と宣言しているので、文字列のまま通すと型が嘘になる。
 * 実際それで 2 か所が壊れていた。Intl.DateTimeFormat#format は引数を
 * ToNumber するため文字列だと NaN になって RangeError で落ち、
 * 停止期間の getTime() は関数が無いと言って落ちる。
 * どちらも「値はあるのに全件で必ず throw する」壊れ方をする。
 *
 * パースできない値は null に倒す。時刻が読めないことより、
 * 画面全体が 500 になることのほうが困る。
 */
function toDate(value: TimestampValue): Date | null {
  if (value === null || value === undefined) return null

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * SQL の CASE 式が返すバケット名を型に落とす。
 *
 * SQL 側の境界は domain/bucket.ts の bucketOf と完全に一致していなければならない。
 * ずれると「御社と同じ本数の企業の当たり率」が別のバケットの数字になり、
 * 集計そのものが静かに壊れる。ここで弾いているのはその事故を検知するため。
 */
function toBucketLabel(value: string): BucketLabel {
  const label = bucketLabels.find((candidate) => candidate === value)
  if (!label) {
    throw new Error(
      `未知のバケットです: ${value} (SQL の CASE と domain/bucket.ts がずれている)`,
    )
  }
  return label
}

const leverKeys = [
  'main_image',
  'keyword',
  'title_number',
  'title_bracket',
] as const satisfies readonly LeverKey[]

function toLeverKey(value: string): LeverKey | null {
  return leverKeys.find((candidate) => candidate === value) ?? null
}

type CompanyRow = {
  readonly company_id: number
  readonly company_name: string | null
  readonly industry_id: number | null
  readonly industry_name: string | null
  /**
   * postgres.js は int8 を精度落ちを避けるため文字列で返す (int4 なら数値)。
   * 実 RDS の型が未照合なのでどちらでも受け、数値化はこちらで行う。
   */
  readonly capital: string | number | null
  readonly foundation_date: TimestampValue
  readonly description: string | null
}

type HistoryAggRow = {
  readonly total_releases: number
  readonly first_released_at: TimestampValue
  readonly last_released_at: TimestampValue
}

type RecentReleaseRow = {
  readonly title: string | null
  readonly released_at: TimestampValue
  readonly page_view: number | null
}

type FeatureUsageRow = {
  readonly total: number
  readonly no_image: number
  readonly no_video: number
  readonly no_subtitle: number
  readonly release_types: number
  readonly titles_with_number: number
  readonly titles_with_bracket: number
}

type KeywordUsageRow = {
  readonly avg_keywords: number
}

type HitCurveRow = {
  readonly bucket: string
  readonly companies: number
  readonly hit_pct: number
  readonly min_n: number
  readonly threshold_pv: number | null
}

type PeriodCurveRow = {
  readonly months: number
  readonly companies: number
  readonly hit_pct: number
  readonly releases_p50: number
  readonly cum_pv_p50: number
  readonly cum_pv_p90: number
}

type TrendRow = {
  readonly release_type_name: string
  readonly n: number
  readonly pv_p50: number | null
  readonly pv_p90: number | null
}

type ResumeSegmentRow = {
  readonly seg: number
  readonly from_n: number
  readonly to_n: number
  readonly companies: number
  readonly hit_before_pct: number
  readonly hit_after_pct: number
  readonly added_p50: number
}

type ResumeGapRow = {
  readonly gap: string
  readonly ord: number
  readonly companies: number
}

type LeverRow = {
  readonly lever: string
  readonly variant: string
  readonly n: number
  readonly hit_pct: number
}

/** 打ち手の片側 (使った / 使わなかった) の集計値 */
type LeverSide = Lever['on']

type StoppedCompanyRow = {
  readonly company_id: number
  readonly company_name: string | null
  readonly industry_name: string | null
  readonly releases: number
  readonly last_at: TimestampValue
}

/**
 * 再開統計は「セグメント別の前後比較」と「休止期間の分布」の 2 本のクエリで、
 * 前半の CTE を共有する。組み立て直すと片方だけ条件がずれる事故が起きるため、
 * 共有部分を 1 か所に持って両方から差し込む。
 */
function resumeBase(industryId: number) {
  return sql`
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
      SELECT company_id, MIN(created_at) AS resume_at,
             MAX(EXTRACT(EPOCH FROM (created_at - prev)) / 2592000) AS gap_months
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
    )`
}

export function drizzleMetricsRepository(): MetricsRepository {
  return {
    async findCompany(companyId) {
      const rows = await statsDb().execute<CompanyRow>(sql`
        SELECT c.company_id, c.company_name, c.industry_id, i.industry_name,
               c.capital, c.foundation_date,
               LEFT(COALESCE(c.description, ''), 300) AS description
          FROM company c
          LEFT JOIN industry i ON i.industry_id = c.industry_id
         WHERE c.company_id = ${companyId}
      `)

      const row = rows[0]
      if (!row) return null

      const profile: CompanyProfile = {
        companyId: row.company_id,
        companyName: row.company_name,
        industryId: row.industry_id,
        industryName: row.industry_name,
        capital: row.capital === null ? null : Number(row.capital),
        foundationDate: toDate(row.foundation_date),
        description: row.description,
      }
      return profile
    },

    async findHistory(companyId) {
      const [aggRows, recentRows] = await Promise.all([
        statsDb().execute<HistoryAggRow>(sql`
          SELECT COUNT(*)::int AS total_releases,
                 MIN(created_at) AS first_released_at,
                 MAX(created_at) AS last_released_at
            FROM release WHERE company_id = ${companyId}
        `),
        statsDb().execute<RecentReleaseRow>(sql`
          SELECT r.title, r.created_at AS released_at, s.page_view
            FROM release r
            LEFT JOIN release_statistic s
                   ON s.company_id = r.company_id AND s.release_id = r.release_id
           WHERE r.company_id = ${companyId}
           ORDER BY r.created_at DESC LIMIT 5
        `),
      ])

      const agg = aggRows[0]
      const lastReleasedAt = toDate(agg?.last_released_at)

      const history: CompanyHistory = {
        totalReleases: agg?.total_releases ?? 0,
        firstReleasedAt: toDate(agg?.first_released_at),
        lastReleasedAt,
        stoppedMonths:
          lastReleasedAt === null
            ? null
            : Math.max(
                0,
                Math.round((Date.now() - lastReleasedAt.getTime()) / monthMs),
              ),
        recent: recentRows.map((row) => ({
          title: row.title,
          releasedAt: toDate(row.released_at),
          pageView: row.page_view,
        })),
      }
      return history
    },

    async findFeatureUsage(companyId) {
      // プロトタイプは release への集計を 2 回に分けていたが、
      // FROM も WHERE も同じなので 1 回にまとめている (結果は同じ・往復が減る)
      const [usageRows, keywordRows] = await Promise.all([
        statsDb().execute<FeatureUsageRow>(sql`
          SELECT COUNT(*)::int AS total,
                 COUNT(*) FILTER (WHERE main_image IS NULL OR main_image = '')::int AS no_image,
                 COUNT(*) FILTER (WHERE youtube_url IS NULL OR youtube_url = '')::int AS no_video,
                 COUNT(*) FILTER (WHERE subtitle IS NULL OR subtitle = '')::int AS no_subtitle,
                 COUNT(DISTINCT release_type_id)::int AS release_types,
                 COUNT(*) FILTER (WHERE title ~ '[0-9０-９]')::int AS titles_with_number,
                 COUNT(*) FILTER (WHERE title LIKE '%【%')::int AS titles_with_bracket
            FROM release WHERE company_id = ${companyId}
        `),
        // AVG は NULL を数えないので、キーワードが 1 件も無いリリースは母数から外れる。
        // プロトタイプの挙動をそのまま維持している (「平均◯件」の意味が変わるため)
        statsDb().execute<KeywordUsageRow>(sql`
          SELECT COALESCE(AVG(kw.cnt), 0)::float AS avg_keywords
            FROM release r
            LEFT JOIN (SELECT company_id, release_id, COUNT(*) AS cnt
                         FROM release_keyword
                        WHERE company_id = ${companyId}
                        GROUP BY company_id, release_id) kw
                   ON kw.company_id = r.company_id AND kw.release_id = r.release_id
           WHERE r.company_id = ${companyId}
        `),
      ])

      const row = usageRows[0]
      const usage: FeatureUsage = {
        total: row?.total ?? 0,
        noImage: row?.no_image ?? 0,
        noVideo: row?.no_video ?? 0,
        noSubtitle: row?.no_subtitle ?? 0,
        releaseTypes: row?.release_types ?? 0,
        avgKeywords: keywordRows[0]?.avg_keywords ?? 0,
        titlesWithNumber: row?.titles_with_number ?? 0,
        titlesWithBracket: row?.titles_with_bracket ?? 0,
      }
      return usage
    },

    async findHitCurve(industryId) {
      // CASE の境界は domain/bucket.ts の bucketOf と必ず同じにすること。
      // n は COUNT(*) なので 1 以上が保証され、bucketOf の n <= 1 と n = 1 は一致する。
      const rows = await statsDb().execute<HitCurveRow>(sql`
        WITH peers AS (SELECT company_id FROM company WHERE industry_id = ${industryId}),
        rel AS (
          SELECT r.company_id, s.page_view
            FROM release r
            JOIN peers p ON p.company_id = r.company_id
            LEFT JOIN release_statistic s
                   ON s.company_id = r.company_id AND s.release_id = r.release_id
        ),
        thr AS (SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY page_view) AS t FROM rel),
        comp AS (
          SELECT company_id, COUNT(*) AS n,
                 MAX(CASE WHEN page_view >= (SELECT t FROM thr) THEN 1 ELSE 0 END) AS hit
            FROM rel GROUP BY 1
        )
        SELECT CASE WHEN n = 1 THEN '1本' WHEN n = 2 THEN '2本' WHEN n = 3 THEN '3本'
                    WHEN n <= 5 THEN '4〜5本' WHEN n <= 10 THEN '6〜10本'
                    WHEN n <= 20 THEN '11〜20本' ELSE '21本以上' END AS bucket,
               COUNT(*)::int AS companies,
               ROUND(AVG(hit) * 100)::int AS hit_pct,
               MIN(n)::int AS min_n,
               (SELECT ROUND(t)::int FROM thr) AS threshold_pv
          FROM comp GROUP BY 1 ORDER BY MIN(n)
      `)

      const first = rows[0]
      if (!first) return null

      const curve: HitCurve = {
        buckets: rows.map((row) => ({
          bucket: toBucketLabel(row.bucket),
          companies: row.companies,
          hitPct: row.hit_pct,
        })),
        thresholdPv: first.threshold_pv ?? 0,
        totalCompanies: rows.reduce((total, row) => total + row.companies, 0),
      }
      return curve
    },

    async findPeriodCurve(industryId) {
      const rows = await statsDb().execute<PeriodCurveRow>(sql`
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
                 SUM(CASE WHEN r.created_at < b.first_at + (m.months || ' months')::interval
                          THEN r.pv ELSE 0 END)::bigint AS cum_pv,
                 MAX(CASE WHEN r.created_at < b.first_at + (m.months || ' months')::interval
                           AND r.pv >= (SELECT t FROM thr) THEN 1 ELSE 0 END) AS hit
            FROM base b
            JOIN rel r ON r.company_id = b.company_id
            CROSS JOIN (VALUES (3),(6),(12),(24),(36)) AS m(months)
           -- 観測期間が足りない企業は除外して打ち切りバイアスを避ける
           WHERE b.first_at + (m.months || ' months')::interval <= NOW()
           GROUP BY 1, 2
        )
        SELECT months::int,
               COUNT(*)::int AS companies,
               ROUND(AVG(hit) * 100)::int AS hit_pct,
               PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY n)::int AS releases_p50,
               PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cum_pv)::int AS cum_pv_p50,
               PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY cum_pv)::int AS cum_pv_p90
          FROM win GROUP BY months ORDER BY months
      `)

      if (rows.length === 0) return null

      const curve: PeriodCurve = {
        rows: rows.map((row) => ({
          months: row.months,
          companies: row.companies,
          hitPct: row.hit_pct,
          releasesP50: row.releases_p50,
          cumPvP50: row.cum_pv_p50,
          cumPvP90: row.cum_pv_p90,
        })),
      }
      return curve
    },

    async findTrends(industryId) {
      const rows = await statsDb().execute<TrendRow>(sql`
        WITH peers AS (SELECT company_id FROM company WHERE industry_id = ${industryId})
        SELECT COALESCE(TRIM(rt.release_type_name), '不明') AS release_type_name,
               COUNT(*)::int AS n,
               PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.page_view)::int AS pv_p50,
               PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY s.page_view)::int AS pv_p90
          FROM release r
          JOIN peers p ON p.company_id = r.company_id
          LEFT JOIN release_type rt ON rt.release_type_id = r.release_type_id
          LEFT JOIN release_statistic s
                 ON s.company_id = r.company_id AND s.release_id = r.release_id
         GROUP BY 1
        HAVING COUNT(*) >= 500
         ORDER BY pv_p90 DESC NULLS LAST
         LIMIT 7
      `)

      const trends: Trends = {
        items: rows.map((row) => ({
          releaseTypeName: row.release_type_name,
          n: row.n,
          pvP50: row.pv_p50,
          pvP90: row.pv_p90,
        })),
      }
      return trends
    },

    async findResumeStats(industryId) {
      const base = resumeBase(industryId)

      const [segmentRows, gapRows] = await Promise.all([
        statsDb().execute<ResumeSegmentRow>(sql`
          ${base}
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
        statsDb().execute<ResumeGapRow>(sql`
          ${base}
          SELECT CASE WHEN gap_months < 9 THEN '6〜9か月' WHEN gap_months < 12 THEN '9〜12か月'
                      WHEN gap_months < 24 THEN '1〜2年' ELSE '2年以上' END AS gap,
                 MIN(gap_months)::int AS ord, COUNT(*)::int AS companies
            FROM resume GROUP BY 1 ORDER BY 2
        `),
      ])

      if (segmentRows.length === 0) return null

      const stats: ResumeStats = {
        segments: segmentRows.map((row) => ({
          seg: row.seg,
          fromN: row.from_n,
          toN: row.to_n,
          companies: row.companies,
          hitBeforePct: row.hit_before_pct,
          hitAfterPct: row.hit_after_pct,
          addedP50: row.added_p50,
        })),
        gaps: gapRows.map((row) => ({
          gap: row.gap,
          companies: row.companies,
        })),
        totalResumed: segmentRows.reduce(
          (total, row) => total + row.companies,
          0,
        ),
      }
      return stats
    },

    async findLevers(industryId) {
      const rows = await statsDb().execute<LeverRow>(sql`
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
                 rel.pv
            FROM rel
          UNION ALL
          SELECT 'keyword',
                 CASE WHEN COALESCE(kw.cnt, 0) >= 3 THEN 'on' ELSE 'off' END, rel.pv
            FROM rel LEFT JOIN kw
              ON kw.company_id = rel.company_id AND kw.release_id = rel.release_id
          UNION ALL
          SELECT 'title_number',
                 CASE WHEN rel.title ~ '[0-9０-９]' THEN 'on' ELSE 'off' END, rel.pv
            FROM rel
          UNION ALL
          SELECT 'title_bracket',
                 CASE WHEN rel.title LIKE '%【%' THEN 'on' ELSE 'off' END, rel.pv
            FROM rel
        )
        SELECT lever, variant, COUNT(*)::int AS n,
               ROUND(AVG(CASE WHEN pv >= (SELECT t FROM thr) THEN 1.0 ELSE 0 END) * 100, 1)::float AS hit_pct
          FROM flat GROUP BY 1, 2
      `)

      // on / off の 2 行が揃って初めて 1 つの打ち手になる。片方しか無ければ落とす
      const sides = new Map<LeverKey, { on?: LeverSide; off?: LeverSide }>()
      for (const row of rows) {
        const key = toLeverKey(row.lever)
        if (!key) continue
        if (row.variant !== 'on' && row.variant !== 'off') continue

        const entry = sides.get(key) ?? {}
        entry[row.variant] = { n: row.n, hitPct: row.hit_pct }
        sides.set(key, entry)
      }

      const levers: Levers = {}
      for (const [key, { on, off }] of sides) {
        if (!on || !off) continue
        levers[key] = {
          on,
          off,
          // off が 0% だと比が発散するので出さない。小数第 1 位までに丸める
          ratio:
            off.hitPct > 0
              ? Math.round((on.hitPct / off.hitPct) * 10) / 10
              : null,
        }
      }
      return levers
    },

    async findStoppedCompanies(limit) {
      const rows = await statsDb().execute<StoppedCompanyRow>(sql`
        SELECT c.company_id, c.company_name, i.industry_name,
               t.n::int AS releases, t.last_at
          FROM (SELECT company_id, COUNT(*) AS n, MAX(created_at) AS last_at
                  FROM release GROUP BY company_id
                 HAVING COUNT(*) BETWEEN 1 AND 3
                 LIMIT 20000) t
          JOIN company c ON c.company_id = t.company_id
          LEFT JOIN industry i ON i.industry_id = c.industry_id
         WHERE t.last_at < NOW() - INTERVAL '9 months'
         ORDER BY t.last_at DESC
         LIMIT ${limit}
      `)

      const companies: readonly StoppedCompany[] = rows.map((row) => ({
        companyId: row.company_id,
        companyName: row.company_name,
        industryName: row.industry_name,
        releases: row.releases,
        lastReleasedAt: toDate(row.last_at),
      }))
      return companies
    },
  }
}
