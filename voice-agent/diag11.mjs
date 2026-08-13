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
await c.query("SET statement_timeout='160s'")
const q = async (l, sql) => {
  const t = Date.now()
  try {
    const r = await c.query(sql)
    console.log(`\n■ ${l}  (${((Date.now() - t) / 1000).toFixed(1)}s)`)
    console.table(r.rows.slice(0, 15))
  } catch (e) {
    console.log(`\n■ ${l} → ${e.message.slice(0, 130)}`)
  }
}

// 主キーワード1件だけ・直近3年に絞って軽くする
await q(
  '跳ねやすい主キーワード（情報通信・直近3年・主キーワードのみ）',
  `
WITH peers AS (SELECT company_id FROM company WHERE industry_id=7),
 rel AS (SELECT r.company_id,r.release_id,COALESCE(s.page_view,0) pv
         FROM release r JOIN peers p ON p.company_id=r.company_id
         LEFT JOIN release_statistic s ON s.company_id=r.company_id AND s.release_id=r.release_id
         WHERE r.created_at >= NOW() - INTERVAL '3 years'),
 thr AS (SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY pv) t FROM rel),
 kw AS (SELECT rk.company_id, rk.release_id, rk.keyword_id
        FROM release_keyword rk JOIN rel ON rel.company_id=rk.company_id AND rel.release_id=rk.release_id
        WHERE rk.sort_priority = 1)
 SELECT k.keyword_name, COUNT(*)::int n,
        ROUND(AVG(CASE WHEN rel.pv>=(SELECT t FROM thr) THEN 1.0 ELSE 0 END)*100,1) hit_pct
 FROM rel JOIN kw ON kw.company_id=rel.company_id AND kw.release_id=rel.release_id
 JOIN keyword k ON k.keyword_id=kw.keyword_id
 GROUP BY 1 HAVING COUNT(*)>=800
 ORDER BY hit_pct DESC LIMIT 15`,
)
c.release()
await p.end()
