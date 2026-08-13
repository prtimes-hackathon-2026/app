import pg from 'pg'; import 'dotenv/config';
const p=new pg.Pool({host:'localhost',port:15432,database:'prtimes',
  user:process.env.DATABASE_USER,password:process.env.DATABASE_PASS,
  ssl:{rejectUnauthorized:false},max:2});
const c=await p.connect(); await c.query("SET statement_timeout='170s'");
const q=async(l,sql)=>{const t=Date.now();
  try{const r=await c.query(sql);console.log(`\n■ ${l}  (${((Date.now()-t)/1000).toFixed(1)}s)`);console.table(r.rows.slice(0,14));}
  catch(e){console.log(`\n■ ${l} → ${e.message.slice(0,130)}`)}};

// ② 同一企業内の前後比較。途中から画像を使い始めた企業だけを見る
await q('画像を「使い始めた」企業の、使用前 vs 使用後（同一企業内）', `
WITH peers AS (SELECT company_id FROM company WHERE industry_id=7),
 rel AS (SELECT r.company_id,r.created_at,r.main_image,COALESCE(s.page_view,0) pv
         FROM release r JOIN peers p ON p.company_id=r.company_id
         LEFT JOIN release_statistic s ON s.company_id=r.company_id AND s.release_id=r.release_id),
 thr AS (SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY pv) t FROM rel),
 sw AS (SELECT company_id, MIN(created_at) FILTER (WHERE main_image IS NOT NULL AND main_image<>'') first_img,
               COUNT(*) FILTER (WHERE main_image IS NULL OR main_image='') n_no,
               COUNT(*) FILTER (WHERE main_image IS NOT NULL AND main_image<>'') n_yes
        FROM rel GROUP BY 1),
 target AS (SELECT * FROM sw WHERE first_img IS NOT NULL AND n_no>=2 AND n_yes>=2)
 SELECT COUNT(DISTINCT r.company_id)::int companies,
   ROUND(AVG(CASE WHEN r.created_at < t.first_img AND r.pv>=(SELECT t FROM thr) THEN 1.0
                  WHEN r.created_at < t.first_img THEN 0.0 END)*100,1) before_pct,
   ROUND(AVG(CASE WHEN r.created_at >= t.first_img AND r.pv>=(SELECT t FROM thr) THEN 1.0
                  WHEN r.created_at >= t.first_img THEN 0.0 END)*100,1) after_pct
 FROM rel r JOIN target t ON t.company_id=r.company_id`);

// ③ 跳ねやすいキーワード（目的の材料）
await q('この業種で跳ねやすいキーワード（上位）', `
WITH peers AS (SELECT company_id FROM company WHERE industry_id=7),
 rel AS (SELECT r.company_id,r.release_id,COALESCE(s.page_view,0) pv
         FROM release r JOIN peers p ON p.company_id=r.company_id
         LEFT JOIN release_statistic s ON s.company_id=r.company_id AND s.release_id=r.release_id),
 thr AS (SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY pv) t FROM rel)
 SELECT k.keyword_name, COUNT(*)::int n,
        ROUND(AVG(CASE WHEN rel.pv>=(SELECT t FROM thr) THEN 1.0 ELSE 0 END)*100,1) hit_pct
 FROM rel
 JOIN release_keyword rk ON rk.company_id=rel.company_id AND rk.release_id=rel.release_id
 JOIN keyword k ON k.keyword_id=rk.keyword_id
 WHERE rk.sort_priority <= 3
 GROUP BY 1 HAVING COUNT(*)>=2000
 ORDER BY hit_pct DESC LIMIT 12`);
c.release(); await p.end();
