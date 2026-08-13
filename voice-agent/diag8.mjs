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
    console.log(`\n■ ${l} → ${e.message.slice(0, 110)}`)
  }
}

const BASE = `WITH peers AS (SELECT company_id FROM company WHERE industry_id=7),
 rel AS (SELECT r.company_id,r.release_id,r.created_at,COALESCE(s.page_view,0) pv
         FROM release r JOIN peers p ON p.company_id=r.company_id
         LEFT JOIN release_statistic s ON s.company_id=r.company_id AND s.release_id=r.release_id),
 thr AS (SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY pv) t FROM rel)`

await q(
  '配信の時間帯 × 当たり率',
  `${BASE}
 SELECT EXTRACT(HOUR FROM created_at)::int AS hr, COUNT(*)::int n,
        ROUND(AVG(CASE WHEN pv>=(SELECT t FROM thr) THEN 1.0 ELSE 0 END)*100,1) hit_pct
 FROM rel WHERE created_at IS NOT NULL GROUP BY 1 HAVING COUNT(*)>=3000 ORDER BY hit_pct DESC LIMIT 10`,
)

await q(
  'キーワード設定数 × 当たり率',
  `${BASE},
 kw AS (SELECT k.company_id,k.release_id,COUNT(*) cnt
        FROM release_keyword k JOIN rel ON rel.company_id=k.company_id AND rel.release_id=k.release_id
        GROUP BY 1,2)
 SELECT CASE WHEN COALESCE(kw.cnt,0)=0 THEN 'a:0件' WHEN kw.cnt<=2 THEN 'b:1-2件'
             WHEN kw.cnt<=5 THEN 'c:3-5件' ELSE 'd:6件以上' END bucket,
        COUNT(*)::int n,
        ROUND(AVG(CASE WHEN rel.pv>=(SELECT t FROM thr) THEN 1.0 ELSE 0 END)*100,1) hit_pct,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY rel.pv)::int pv_p50
 FROM rel LEFT JOIN kw ON kw.company_id=rel.company_id AND kw.release_id=rel.release_id
 GROUP BY 1 ORDER BY 1`,
)
c.release()
await p.end()
