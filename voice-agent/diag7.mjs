import pg from 'pg'; import 'dotenv/config';
const p=new pg.Pool({host:'localhost',port:15432,database:'prtimes',
  user:process.env.DATABASE_USER,password:process.env.DATABASE_PASS,
  ssl:{rejectUnauthorized:false},max:2});
const c=await p.connect(); await c.query("SET statement_timeout='170s'");
const q=async(l,sql)=>{const t=Date.now();
  try{const r=await c.query(sql);console.log(`\n■ ${l}  (${((Date.now()-t)/1000).toFixed(1)}s)`);console.table(r.rows.slice(0,14));}
  catch(e){console.log(`\n■ ${l} → ${e.message.slice(0,110)}`)}};

const BASE = `WITH peers AS (SELECT company_id FROM company WHERE industry_id=7),
 rel AS (SELECT r.company_id,r.release_id,r.title,r.created_at,r.main_image,
                COALESCE(s.page_view,0) pv
         FROM release r JOIN peers p ON p.company_id=r.company_id
         LEFT JOIN release_statistic s ON s.company_id=r.company_id AND s.release_id=r.release_id),
 thr AS (SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY pv) t FROM rel)`;

await q('配信の曜日 × 当たり率', `${BASE}
 SELECT TO_CHAR(created_at,'Dy') dow, COUNT(*)::int n,
        ROUND(AVG(CASE WHEN pv>=(SELECT t FROM thr) THEN 1.0 ELSE 0 END)*100,1) hit_pct,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pv)::int pv_p50
 FROM rel GROUP BY 1, EXTRACT(DOW FROM created_at) ORDER BY EXTRACT(DOW FROM created_at)`);

await q('配信の時間帯 × 当たり率', `${BASE}
 SELECT EXTRACT(HOUR FROM created_at)::int hour, COUNT(*)::int n,
        ROUND(AVG(CASE WHEN pv>=(SELECT t FROM thr) THEN 1.0 ELSE 0 END)*100,1) hit_pct
 FROM rel GROUP BY 1 ORDER BY hit_pct DESC LIMIT 8`);

await q('タイトルの長さ × 当たり率', `${BASE}
 SELECT CASE WHEN LENGTH(title)<25 THEN 'a:25字未満' WHEN LENGTH(title)<40 THEN 'b:25-39字'
             WHEN LENGTH(title)<55 THEN 'c:40-54字' WHEN LENGTH(title)<70 THEN 'd:55-69字'
             ELSE 'e:70字以上' END bucket,
        COUNT(*)::int n,
        ROUND(AVG(CASE WHEN pv>=(SELECT t FROM thr) THEN 1.0 ELSE 0 END)*100,1) hit_pct,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pv)::int pv_p50
 FROM rel GROUP BY 1 ORDER BY 1`);

await q('タイトルの書き方 × 当たり率', `${BASE}
 SELECT feature, COUNT(*)::int n,
        ROUND(AVG(CASE WHEN pv>=(SELECT t FROM thr) THEN 1.0 ELSE 0 END)*100,1) hit_pct
 FROM (SELECT pv, CASE WHEN title ~ '[0-9０-９]' THEN '数字を含む' ELSE '数字なし' END feature FROM rel
       UNION ALL SELECT pv, CASE WHEN title LIKE '%【%' THEN '【】を含む' ELSE '【】なし' END FROM rel
       UNION ALL SELECT pv, CASE WHEN title LIKE '%「%' THEN '「」を含む' ELSE '「」なし' END FROM rel
       UNION ALL SELECT pv, CASE WHEN title LIKE '%～%' OR title LIKE '%〜%' THEN '～で補足' ELSE '～なし' END FROM rel) x
 GROUP BY 1 ORDER BY hit_pct DESC`);

await q('メイン画像の有無 × 当たり率', `${BASE}
 SELECT CASE WHEN main_image IS NULL OR main_image='' THEN '画像なし' ELSE '画像あり' END img,
        COUNT(*)::int n,
        ROUND(AVG(CASE WHEN pv>=(SELECT t FROM thr) THEN 1.0 ELSE 0 END)*100,1) hit_pct,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pv)::int pv_p50
 FROM rel GROUP BY 1`);
c.release(); await p.end();
