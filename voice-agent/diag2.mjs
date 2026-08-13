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
const q = async (l, sql, ms = 60000) => {
  const t = Date.now()
  try {
    const c = await p.connect()
    await c.query(`SET statement_timeout='${ms}'`)
    const r = await c.query(sql)
    c.release()
    console.log(`\n■ ${l}  (${((Date.now() - t) / 1000).toFixed(1)}s)`)
    console.table(r.rows.slice(0, 8))
  } catch (e) {
    console.log(
      `\n■ ${l} → ${e.message.slice(0, 90)}  (${((Date.now() - t) / 1000).toFixed(1)}s)`,
    )
  }
}

await q(
  'webclippingの件数分布（サンプル10万本）',
  `
 WITH s AS (SELECT company_id,release_id FROM release LIMIT 100000),
 c AS (SELECT w.company_id,w.release_id,COUNT(*) n FROM webclipping_list w
       JOIN s ON s.company_id=w.company_id AND s.release_id=w.release_id
       GROUP BY 1,2)
 SELECT CASE WHEN n=0 THEN '0' WHEN n<=5 THEN '1-5' WHEN n<=20 THEN '6-20'
             WHEN n<=100 THEN '21-100' ELSE '100+' END AS bucket,
        COUNT(*)::int AS releases
 FROM c GROUP BY 1 ORDER BY 1`,
  90000,
)

await q(
  'PV中央値（情報通信・nth別）所要時間テスト',
  `
 WITH peers AS (SELECT company_id FROM company WHERE industry_id=(SELECT industry_id FROM industry WHERE industry_name='情報通信')),
 ranked AS (SELECT r.company_id,
   ROW_NUMBER() OVER (PARTITION BY r.company_id ORDER BY r.created_at) nth, s.page_view
   FROM release r JOIN peers p ON p.company_id=r.company_id
   LEFT JOIN release_statistic s ON s.company_id=r.company_id AND s.release_id=r.release_id)
 SELECT nth::int, COUNT(*)::int n,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY page_view)::int pv_median
 FROM ranked WHERE nth<=8 GROUP BY nth ORDER BY nth`,
  90000,
)
await p.end()
