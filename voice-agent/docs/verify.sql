-- ============================================================
-- 残り2件の検証（pgAdmin にそのまま貼って実行してください）
-- 会場のネットワークからなら pgAdmin が開けます: http://13.158.197.89
-- 対象は情報通信（industry_id = 7）
-- ============================================================


-- ------------------------------------------------------------
-- 【1】地域指定の有無で当たり率に差があるか
--      → 差が無ければ「地域指定を勧める機能」は作らない
-- ------------------------------------------------------------
WITH peers AS (SELECT company_id FROM company WHERE industry_id = 7),
rel AS (
  SELECT r.company_id, r.release_id, COALESCE(s.page_view, 0) AS pv
    FROM release r
    JOIN peers p ON p.company_id = r.company_id
    LEFT JOIN release_statistic s
           ON s.company_id = r.company_id AND s.release_id = r.release_id
),
thr AS (SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY pv) AS t FROM rel),
loc AS (SELECT DISTINCT company_id, release_id FROM release_location)
SELECT CASE WHEN l.release_id IS NULL THEN '地域指定なし' ELSE '地域指定あり' END AS 設定,
       COUNT(*)::int AS 本数,
       ROUND(AVG(CASE WHEN rel.pv >= (SELECT t FROM thr) THEN 1.0 ELSE 0 END) * 100, 1) AS 当たり率
  FROM rel
  LEFT JOIN loc l ON l.company_id = rel.company_id AND l.release_id = rel.release_id
 GROUP BY 1;


-- ------------------------------------------------------------
-- 【2】カテゴリ数で当たり率に差があるか
-- ------------------------------------------------------------
WITH peers AS (SELECT company_id FROM company WHERE industry_id = 7),
rel AS (
  SELECT r.company_id, r.release_id, COALESCE(s.page_view, 0) AS pv
    FROM release r
    JOIN peers p ON p.company_id = r.company_id
    LEFT JOIN release_statistic s
           ON s.company_id = r.company_id AND s.release_id = r.release_id
),
thr AS (SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY pv) AS t FROM rel),
cat AS (
  SELECT company_id, release_id, COUNT(*) AS n
    FROM release_business_category GROUP BY 1, 2
)
SELECT CASE WHEN COALESCE(cat.n, 0) = 0 THEN 'a:0件'
            WHEN cat.n = 1 THEN 'b:1件'
            WHEN cat.n = 2 THEN 'c:2件'
            ELSE 'd:3件以上' END AS カテゴリ数,
       COUNT(*)::int AS 本数,
       ROUND(AVG(CASE WHEN rel.pv >= (SELECT t FROM thr) THEN 1.0 ELSE 0 END) * 100, 1) AS 当たり率
  FROM rel
  LEFT JOIN cat ON cat.company_id = rel.company_id AND cat.release_id = rel.release_id
 GROUP BY 1 ORDER BY 1;


-- ------------------------------------------------------------
-- 【3】3か月以内に「どこまで届いたか」の達成率
--      → 「短期なら広告のほうがいい」を、言い切らず数字で示すための材料
-- ------------------------------------------------------------
WITH peers AS (SELECT company_id FROM company WHERE industry_id = 7),
base AS (
  SELECT r.company_id, MIN(r.created_at) AS first_at
    FROM release r JOIN peers p ON p.company_id = r.company_id
   GROUP BY 1
),
w AS (
  SELECT b.company_id,
         SUM(COALESCE(s.page_view, 0))::bigint AS cum,
         MAX(COALESCE(s.page_view, 0))::int    AS best,
         COUNT(*)::int                          AS n
    FROM base b
    JOIN release r ON r.company_id = b.company_id
    LEFT JOIN release_statistic s
           ON s.company_id = r.company_id AND s.release_id = r.release_id
   WHERE r.created_at < b.first_at + INTERVAL '3 months'
     AND b.first_at + INTERVAL '3 months' <= NOW()   -- 観測期間が足りない企業は除外
   GROUP BY 1
)
SELECT COUNT(*)::int AS 対象企業数,
       ROUND(AVG(n), 1)                                                  AS 平均配信本数,
       ROUND(AVG(CASE WHEN best >=   50 THEN 1.0 ELSE 0 END) * 100, 1) AS "1本でも50PV以上",
       ROUND(AVG(CASE WHEN best >=  200 THEN 1.0 ELSE 0 END) * 100, 1) AS "1本でも200PV以上",
       ROUND(AVG(CASE WHEN best >= 1000 THEN 1.0 ELSE 0 END) * 100, 1) AS "1本でも1000PV以上",
       ROUND(AVG(CASE WHEN cum  >=  500 THEN 1.0 ELSE 0 END) * 100, 1) AS "累計500PV以上"
  FROM w;
