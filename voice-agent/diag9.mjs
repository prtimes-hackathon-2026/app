import pg from 'pg'
import 'dotenv/config'
const p = new pg.Pool({
  host: 'localhost',
  port: 15432,
  database: 'prtimes',
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASS,
  ssl: { rejectUnauthorized: false },
  max: 2,
})
const c = await p.connect()
await c.query("SET statement_timeout='170s'")
const q = async (l, sql) => {
  const t = Date.now()
  try {
    const r = await c.query(sql)
    console.log(`\n■ ${l}  (${((Date.now() - t) / 1000).toFixed(1)}s)`)
    console.table(r.rows.slice(0, 14))
  } catch (e) {
    console.log(`\n■ ${l} → ${e.message.slice(0, 120)}`)
  }
}

// 一度6か月以上止まってから再開した企業を追跡する
const BASE = `
WITH peers AS (SELECT company_id FROM company WHERE industry_id=7),
 rel AS (SELECT r.company_id, r.created_at, COALESCE(s.page_view,0) pv
         FROM release r JOIN peers p ON p.company_id=r.company_id
         LEFT JOIN release_statistic s ON s.company_id=r.company_id AND s.release_id=r.release_id),
 thr AS (SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY pv) t FROM rel),
 g AS (SELECT company_id, created_at, pv,
        LAG(created_at) OVER (PARTITION BY company_id ORDER BY created_at) prev
       FROM rel),
 resume AS (SELECT company_id, MIN(created_at) resume_at,
                   MAX(EXTRACT(EPOCH FROM (created_at-prev))/2592000) gap_months
            FROM g WHERE prev IS NOT NULL AND created_at - prev > INTERVAL '6 months'
            GROUP BY 1),
 after AS (SELECT r.company_id, COUNT(*)::int n_after,
                  MAX(CASE WHEN r.pv >= (SELECT t FROM thr) THEN 1 ELSE 0 END) hit_after
           FROM rel r JOIN resume s ON s.company_id=r.company_id
           WHERE r.created_at >= s.resume_at GROUP BY 1),
 before AS (SELECT r.company_id, COUNT(*)::int n_before,
                   MAX(CASE WHEN r.pv >= (SELECT t FROM thr) THEN 1 ELSE 0 END) hit_before
            FROM rel r JOIN resume s ON s.company_id=r.company_id
            WHERE r.created_at < s.resume_at GROUP BY 1)`

await q(
  '休止して再開した企業：再開前の本数別に、再開後の結果',
  `${BASE}
 SELECT CASE WHEN b.n_before=1 THEN '再開前1本' WHEN b.n_before<=3 THEN '再開前2-3本'
             WHEN b.n_before<=10 THEN '再開前4-10本' ELSE '再開前11本以上' END AS seg,
        COUNT(*)::int companies,
        ROUND(AVG(b.hit_before)*100)::int hit_before_pct,
        ROUND(AVG(a.hit_after)*100)::int hit_after_pct,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY a.n_after)::int n_after_p50
 FROM before b JOIN after a ON a.company_id=b.company_id
 GROUP BY 1 ORDER BY MIN(b.n_before)`,
)

await q(
  '再開した企業の休止期間の分布',
  `${BASE}
 SELECT CASE WHEN gap_months<9 THEN 'a:6-9か月' WHEN gap_months<12 THEN 'b:9-12か月'
             WHEN gap_months<24 THEN 'c:1-2年' ELSE 'd:2年以上' END AS gap,
        COUNT(*)::int companies
 FROM resume GROUP BY 1 ORDER BY 1`,
)

await q(
  '1本で止まった企業のうち、再開した割合',
  `${BASE},
 firsts AS (SELECT company_id, COUNT(*)::int n FROM rel GROUP BY 1)
 SELECT COUNT(*) FILTER (WHERE f.n=1)::int AS still_one,
        COUNT(*) FILTER (WHERE r.company_id IS NOT NULL)::int AS resumed_any,
        COUNT(*)::int AS all_companies
 FROM firsts f LEFT JOIN resume r ON r.company_id=f.company_id`,
)
c.release()
await p.end()
