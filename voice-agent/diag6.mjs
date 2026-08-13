import pg from 'pg'; import 'dotenv/config';
const p=new pg.Pool({host:'localhost',port:15432,database:'prtimes',
  user:process.env.DATABASE_USER,password:process.env.DATABASE_PASS,
  ssl:{rejectUnauthorized:false},max:2});
const c=await p.connect(); await c.query("SET statement_timeout='180s'");
const t=Date.now();
const r = await c.query(`
WITH peers AS (SELECT company_id FROM company WHERE industry_id = 7),
rel AS (
  SELECT r.company_id, r.created_at, COALESCE(s.page_view,0) AS pv
    FROM release r JOIN peers p ON p.company_id = r.company_id
    LEFT JOIN release_statistic s
           ON s.company_id = r.company_id AND s.release_id = r.release_id
),
thr AS (SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY pv) AS t FROM rel),
base AS (SELECT company_id, MIN(created_at) AS first_at FROM rel GROUP BY 1),
win AS (
  SELECT b.company_id, m.months,
         COUNT(*) FILTER (WHERE r.created_at < b.first_at + (m.months || ' months')::interval)::int AS n,
         SUM(CASE WHEN r.created_at < b.first_at + (m.months || ' months')::interval THEN r.pv ELSE 0 END)::bigint AS cum_pv,
         MAX(CASE WHEN r.created_at < b.first_at + (m.months || ' months')::interval
                   AND r.pv >= (SELECT t FROM thr) THEN 1 ELSE 0 END) AS hit
    FROM base b
    JOIN rel r ON r.company_id = b.company_id
    CROSS JOIN (VALUES (3),(6),(12),(24),(36)) AS m(months)
   -- 観測期間が足りない企業は除外（打ち切りバイアスを避ける）
   WHERE b.first_at + (m.months || ' months')::interval <= NOW()
   GROUP BY 1,2
)
SELECT months,
       COUNT(*)::int AS companies,
       ROUND(AVG(hit)*100)::int AS hit_pct,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY n)::int AS releases_p50,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cum_pv)::int AS cum_pv_p50,
       PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY cum_pv)::int AS cum_pv_p75,
       PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY cum_pv)::int AS cum_pv_p90,
       (SELECT ROUND(t)::int FROM thr) AS threshold_pv
  FROM win GROUP BY months ORDER BY months`);
console.log(`\n■ 情報通信：初回配信からの経過期間ごと  (${((Date.now()-t)/1000).toFixed(1)}s)`);
console.table(r.rows);
c.release(); await p.end();
