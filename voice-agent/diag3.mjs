import pg from 'pg'; import 'dotenv/config';
const p=new pg.Pool({host:'localhost',port:15432,database:'prtimes',
  user:process.env.DATABASE_USER,password:process.env.DATABASE_PASS,
  ssl:{rejectUnauthorized:false},max:2});
const q=async(l,sql,ms=90000)=>{const t=Date.now();
  try{const c=await p.connect();await c.query(`SET statement_timeout='${ms}'`);
    const r=await c.query(sql);c.release();
    console.log(`\n■ ${l}  (${((Date.now()-t)/1000).toFixed(1)}s)`);console.table(r.rows.slice(0,12));}
  catch(e){console.log(`\n■ ${l} → ${e.message.slice(0,90)}`)}};

await q('page_view の分布（情報通信）',`
 WITH peers AS (SELECT company_id FROM company WHERE industry_id=2 LIMIT 5000)
 SELECT COUNT(*)::int total,
   COUNT(*) FILTER (WHERE s.page_view IS NULL)::int nulls,
   COUNT(*) FILTER (WHERE s.page_view=0)::int zeros,
   MIN(s.page_view)::int min, MAX(s.page_view)::int max,
   PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.page_view)::int p50,
   PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY s.page_view)::int p90,
   PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY s.page_view)::int p99
 FROM release r JOIN peers p ON p.company_id=r.company_id
 LEFT JOIN release_statistic s ON s.company_id=r.company_id AND s.release_id=r.release_id`);

await q('unique_user / like_count も見る',`
 WITH peers AS (SELECT company_id FROM company WHERE industry_id=2 LIMIT 5000)
 SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.unique_user)::int uu_p50,
        PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY s.unique_user)::int uu_p90,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.like_count)::int like_p50,
        MAX(s.like_count)::int like_max
 FROM release r JOIN peers p ON p.company_id=r.company_id
 LEFT JOIN release_statistic s ON s.company_id=r.company_id AND s.release_id=r.release_id`);

await q('nth別の転載件数（情報通信・5000社）',`
 WITH peers AS (SELECT company_id FROM company WHERE industry_id=2 LIMIT 5000),
 ranked AS (SELECT r.company_id,r.release_id,
   ROW_NUMBER() OVER (PARTITION BY r.company_id ORDER BY r.created_at) nth
   FROM release r JOIN peers p ON p.company_id=r.company_id),
 c AS (SELECT w.company_id,w.release_id,COUNT(*) n FROM webclipping_list w
       JOIN ranked k ON k.company_id=w.company_id AND k.release_id=w.release_id
       GROUP BY 1,2)
 SELECT k.nth::int, COUNT(*)::int releases,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY COALESCE(c.n,0))::int clip_median
 FROM ranked k LEFT JOIN c ON c.company_id=k.company_id AND c.release_id=k.release_id
 WHERE k.nth<=10 GROUP BY 1 ORDER BY 1`);
await p.end();
