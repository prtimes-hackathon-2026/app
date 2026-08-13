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
const q = async (label, sql, params = []) => {
  const t = Date.now()
  try {
    const r = await p.query({ text: sql, values: params })
    console.log(`\n■ ${label}  (${Date.now() - t}ms)`)
    console.table(r.rows.slice(0, 10))
  } catch (e) {
    console.log(`\n■ ${label} → ERROR ${e.message}`)
  }
}
await p.query("SET statement_timeout = '25s'")
await q(
  'インデックス（release系）',
  `
  SELECT tablename, indexname, indexdef FROM pg_indexes
  WHERE tablename IN ('release','release_statistic','webclipping_list','release_keyword','company')
  ORDER BY tablename`,
)
await q(
  '業種ごとの企業数',
  `
  SELECT i.industry_name, COUNT(*)::int AS companies
  FROM company c JOIN industry i ON i.industry_id=c.industry_id
  GROUP BY 1 ORDER BY 2 DESC`,
)
await q(
  'release_type',
  `SELECT release_type_id, release_type_name FROM release_type ORDER BY 1`,
)
await q(
  '配信本数の分布',
  `
  SELECT n_releases, COUNT(*)::int AS companies FROM (
    SELECT company_id, COUNT(*) AS n_releases FROM release GROUP BY 1
  ) t WHERE n_releases <= 5 GROUP BY 1 ORDER BY 1`,
)
await p.end()
