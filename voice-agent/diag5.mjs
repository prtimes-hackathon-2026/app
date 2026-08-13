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
await c.query("SET statement_timeout='150s'")
const [{ industry_id: IID }] = (
  await c.query(
    "SELECT industry_id FROM industry WHERE industry_name='情報通信'",
  )
).rows
console.log('情報通信 industry_id =', IID)
const q = async (l, sql) => {
  const t = Date.now()
  try {
    const r = await c.query(sql, [IID])
    console.log(`\n■ ${l}  (${((Date.now() - t) / 1000).toFixed(1)}s)`)
    console.table(r.rows.slice(0, 12))
  } catch (e) {
    console.log(`\n■ ${l} → ${e.message.slice(0, 100)}`)
  }
}

await q(
  '配信本数別「当たり(PV上位10%)を引いた企業の割合」',
  `
 WITH peers AS (SELECT company_id FROM company WHERE industry_id=$1),
 rel AS (SELECT r.company_id, s.page_view
         FROM release r JOIN peers p ON p.company_id=r.company_id
         LEFT JOIN release_statistic s ON s.company_id=r.company_id AND s.release_id=r.release_id),
 thr AS (SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY page_view) t FROM rel),
 comp AS (SELECT company_id, COUNT(*) n,
                 MAX(CASE WHEN page_view >= (SELECT t FROM thr) THEN 1 ELSE 0 END) hit
          FROM rel GROUP BY 1)
 SELECT CASE WHEN n=1 THEN '1本' WHEN n=2 THEN '2本' WHEN n=3 THEN '3本'
             WHEN n<=5 THEN '4-5本' WHEN n<=10 THEN '6-10本'
             WHEN n<=20 THEN '11-20本' ELSE '21本以上' END AS bucket,
        COUNT(*)::int companies, ROUND(AVG(hit)*100)::int hit_pct,
        (SELECT ROUND(t)::int FROM thr) AS threshold_pv
 FROM comp GROUP BY 1 ORDER BY MIN(n)`,
)

await q(
  'リリース種別ごとのPV',
  `
 WITH peers AS (SELECT company_id FROM company WHERE industry_id=$1)
 SELECT COALESCE(rt.release_type_name,'不明') AS type, COUNT(*)::int n,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.page_view)::int pv_p50,
        PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY s.page_view)::int pv_p90
 FROM release r JOIN peers p ON p.company_id=r.company_id
 LEFT JOIN release_type rt ON rt.release_type_id=r.release_type_id
 LEFT JOIN release_statistic s ON s.company_id=r.company_id AND s.release_id=r.release_id
 GROUP BY 1 HAVING COUNT(*)>=500 ORDER BY pv_p50 DESC`,
)
c.release()
await p.end()
