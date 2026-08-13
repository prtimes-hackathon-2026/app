import { USING_MOCK, query } from './db.js';
import * as mock from './mock.js';

/**
 * 実データで分かったこと（2026-08-13 / prtimes RDS）
 *
 *  ・PVの中央値は配信本数を重ねても伸びない（情報通信で 13 → 12 で横ばい）
 *  ・一方でPVのばらつきが極端に大きい（中央値25 / 上位10%=128 / 上位1%=1,487）
 *  ・つまり1本ごとが「くじ」であり、本数を重ねるほど当たりを引く確率が上がる
 *      1本 17% → 3本 29% → 6-10本 47% → 21本以上 87%
 *  ・メディア転載はほぼ全リリースで発生するため「転載率」では差がつかない
 *
 * よってこのサービスの中心指標は
 *   「配信本数別に、手応えのある結果（業種内PV上位10%）に届いた企業の割合」
 */

const CACHE = new Map();
const TTL = 30 * 60 * 1000;

async function cached(key, fn) {
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const value = await fn();
  CACHE.set(key, { at: Date.now(), value });
  return value;
}

export const BUCKET_LABELS = ['1本', '2本', '3本', '4〜5本', '6〜10本', '11〜20本', '21本以上'];

export function bucketOf(n) {
  if (n <= 1) return '1本';
  if (n === 2) return '2本';
  if (n === 3) return '3本';
  if (n <= 5) return '4〜5本';
  if (n <= 10) return '6〜10本';
  if (n <= 20) return '11〜20本';
  return '21本以上';
}

// ─────────────────────────────────────────── 企業

export async function getCompany(companyId) {
  if (USING_MOCK) return mock.mockCompany();
  const rows = await query(
    `SELECT c.company_id, c.company_name, c.industry_id, i.industry_name,
            c.capital, c.foundation_date, LEFT(COALESCE(c.description,''), 300) AS description
       FROM company c
       LEFT JOIN industry i ON i.industry_id = c.industry_id
      WHERE c.company_id = $1`,
    [companyId],
  );
  return rows[0] || null;
}

export async function getHistory(companyId) {
  if (USING_MOCK) return mock.mockHistory();

  const [agg] = await query(
    `SELECT COUNT(*)::int AS total_releases,
            MIN(created_at) AS first_released_at,
            MAX(created_at) AS last_released_at
       FROM release WHERE company_id = $1`,
    [companyId],
  );

  const recent = await query(
    `SELECT r.title, r.created_at AS released_at, s.page_view
       FROM release r
       LEFT JOIN release_statistic s
              ON s.company_id = r.company_id AND s.release_id = r.release_id
      WHERE r.company_id = $1
      ORDER BY r.created_at DESC LIMIT 5`,
    [companyId],
  );

  const last = agg.last_released_at ? new Date(agg.last_released_at) : null;
  return {
    total_releases: agg.total_releases,
    first_released_at: agg.first_released_at,
    last_released_at: agg.last_released_at,
    stopped_months: last
      ? Math.max(0, Math.round((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24 * 30.4)))
      : null,
    recent,
  };
}

// ─────────────────────────────────────────── 中心指標：当たり率カーブ

export async function getHitCurve(industryId) {
  if (USING_MOCK) return mock.mockHitCurve();

  return cached(`hit:${industryId}`, async () => {
    const rows = await query(
      `WITH peers AS (SELECT company_id FROM company WHERE industry_id = $1),
       rel AS (
         SELECT r.company_id, s.page_view
           FROM release r
           JOIN peers p ON p.company_id = r.company_id
           LEFT JOIN release_statistic s
                  ON s.company_id = r.company_id AND s.release_id = r.release_id
       ),
       thr AS (SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY page_view) AS t FROM rel),
       comp AS (
         SELECT company_id, COUNT(*) AS n,
                MAX(CASE WHEN page_view >= (SELECT t FROM thr) THEN 1 ELSE 0 END) AS hit
           FROM rel GROUP BY 1
       )
       SELECT CASE WHEN n = 1 THEN '1本' WHEN n = 2 THEN '2本' WHEN n = 3 THEN '3本'
                   WHEN n <= 5 THEN '4〜5本' WHEN n <= 10 THEN '6〜10本'
                   WHEN n <= 20 THEN '11〜20本' ELSE '21本以上' END AS bucket,
              COUNT(*)::int AS companies,
              ROUND(AVG(hit) * 100)::int AS hit_pct,
              MIN(n)::int AS min_n,
              (SELECT ROUND(t)::int FROM thr) AS threshold_pv
         FROM comp GROUP BY 1 ORDER BY MIN(n)`,
      [industryId],
    );
    if (!rows.length) return null;
    return {
      buckets: rows.map(({ bucket, companies, hit_pct }) => ({ bucket, companies, hit_pct })),
      threshold_pv: rows[0].threshold_pv,
      total_companies: rows.reduce((a, r) => a + r.companies, 0),
    };
  });
}

// ─────────────────────────────────────────── 期間で見た場合

/**
 * 初回配信からの経過期間ごとの当たり率・累積PV・配信本数。
 * 本数で見ると 17%→87% だが、期間で見ると3年で13%→23%にしかならない。
 * 「時間では上がらない。本数でしか上がらない」を示すための対になる指標。
 */
export async function getPeriodCurve(industryId) {
  if (USING_MOCK) return mock.mockPeriodCurve();

  return cached(`period:${industryId}`, async () => {
    const rows = await query(
      `WITH peers AS (SELECT company_id FROM company WHERE industry_id = $1),
       rel AS (
         SELECT r.company_id, r.created_at, COALESCE(s.page_view, 0) AS pv
           FROM release r
           JOIN peers p ON p.company_id = r.company_id
           LEFT JOIN release_statistic s
                  ON s.company_id = r.company_id AND s.release_id = r.release_id
       ),
       thr AS (SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY pv) AS t FROM rel),
       base AS (SELECT company_id, MIN(created_at) AS first_at FROM rel GROUP BY 1),
       win AS (
         SELECT b.company_id, m.months,
                COUNT(*) FILTER (
                  WHERE r.created_at < b.first_at + (m.months || ' months')::interval)::int AS n,
                SUM(CASE WHEN r.created_at < b.first_at + (m.months || ' months')::interval
                         THEN r.pv ELSE 0 END)::bigint AS cum_pv,
                MAX(CASE WHEN r.created_at < b.first_at + (m.months || ' months')::interval
                          AND r.pv >= (SELECT t FROM thr) THEN 1 ELSE 0 END) AS hit
           FROM base b
           JOIN rel r ON r.company_id = b.company_id
           CROSS JOIN (VALUES (3),(6),(12),(24),(36)) AS m(months)
          -- 観測期間が足りない企業は除外して打ち切りバイアスを避ける
          WHERE b.first_at + (m.months || ' months')::interval <= NOW()
          GROUP BY 1, 2
       )
       SELECT months::int,
              COUNT(*)::int AS companies,
              ROUND(AVG(hit) * 100)::int AS hit_pct,
              PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY n)::int AS releases_p50,
              PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cum_pv)::int AS cum_pv_p50,
              PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY cum_pv)::int AS cum_pv_p90
         FROM win GROUP BY months ORDER BY months`,
      [industryId],
    );
    return { rows };
  });
}

// ─────────────────────────────────────────── 傾向：リリース種別ごと

export async function getTrends(industryId) {
  if (USING_MOCK) return mock.mockTrends();

  return cached(`trend:${industryId}`, async () => {
    const rows = await query(
      `WITH peers AS (SELECT company_id FROM company WHERE industry_id = $1)
       SELECT COALESCE(TRIM(rt.release_type_name), '不明') AS release_type_name,
              COUNT(*)::int AS n,
              PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.page_view)::int AS pv_p50,
              PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY s.page_view)::int AS pv_p90
         FROM release r
         JOIN peers p ON p.company_id = r.company_id
         LEFT JOIN release_type rt ON rt.release_type_id = r.release_type_id
         LEFT JOIN release_statistic s
                ON s.company_id = r.company_id AND s.release_id = r.release_id
        GROUP BY 1
       HAVING COUNT(*) >= 500
        ORDER BY pv_p90 DESC NULLS LAST
        LIMIT 7`,
      [industryId],
    );
    return { items: rows };
  });
}

// ─────────────────────────────────────────── 休止から再開した企業

/**
 * 一度6か月以上止まってから再開した企業を追跡する。
 * 情報通信での実測（2026-08-13）:
 *   休止前1本だった企業 4,291社 … 休止前の当たり率9% → 再開後44%（追加は中央値3本）
 *   休止期間が2年以上でも 2,671社が再開している
 *
 * 「もう一度やってみよう」を支える唯一の材料。方法論ではなく実例が人を動かす。
 */
export async function getResumeStats(industryId) {
  if (USING_MOCK) return mock.mockResume();

  return cached(`resume:${industryId}`, async () => {
    const base = `
      WITH peers AS (SELECT company_id FROM company WHERE industry_id = $1),
      rel AS (
        SELECT r.company_id, r.created_at, COALESCE(s.page_view, 0) AS pv
          FROM release r
          JOIN peers p ON p.company_id = r.company_id
          LEFT JOIN release_statistic s
                 ON s.company_id = r.company_id AND s.release_id = r.release_id
      ),
      thr AS (SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY pv) AS t FROM rel),
      g AS (
        SELECT company_id, created_at, pv,
               LAG(created_at) OVER (PARTITION BY company_id ORDER BY created_at) AS prev
          FROM rel
      ),
      resume AS (
        SELECT company_id, MIN(created_at) AS resume_at,
               MAX(EXTRACT(EPOCH FROM (created_at - prev)) / 2592000) AS gap_months
          FROM g
         WHERE prev IS NOT NULL AND created_at - prev > INTERVAL '6 months'
         GROUP BY 1
      ),
      after AS (
        SELECT r.company_id, COUNT(*)::int AS n_after,
               MAX(CASE WHEN r.pv >= (SELECT t FROM thr) THEN 1 ELSE 0 END) AS hit_after
          FROM rel r JOIN resume s ON s.company_id = r.company_id
         WHERE r.created_at >= s.resume_at GROUP BY 1
      ),
      before AS (
        SELECT r.company_id, COUNT(*)::int AS n_before,
               MAX(CASE WHEN r.pv >= (SELECT t FROM thr) THEN 1 ELSE 0 END) AS hit_before
          FROM rel r JOIN resume s ON s.company_id = r.company_id
         WHERE r.created_at < s.resume_at GROUP BY 1
      )`;

    const segments = await query(
      `${base}
       SELECT CASE WHEN b.n_before = 1 THEN 1 WHEN b.n_before <= 3 THEN 2
                   WHEN b.n_before <= 10 THEN 3 ELSE 4 END AS seg,
              MIN(b.n_before)::int AS from_n, MAX(b.n_before)::int AS to_n,
              COUNT(*)::int AS companies,
              ROUND(AVG(b.hit_before) * 100)::int AS hit_before_pct,
              ROUND(AVG(a.hit_after) * 100)::int AS hit_after_pct,
              PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY a.n_after)::int AS added_p50
         FROM before b JOIN after a ON a.company_id = b.company_id
        GROUP BY 1 ORDER BY 1`,
      [industryId],
    );

    const gaps = await query(
      `${base}
       SELECT CASE WHEN gap_months < 9 THEN '6〜9か月' WHEN gap_months < 12 THEN '9〜12か月'
                   WHEN gap_months < 24 THEN '1〜2年' ELSE '2年以上' END AS gap,
              MIN(gap_months)::int AS ord, COUNT(*)::int AS companies
         FROM resume GROUP BY 1 ORDER BY 2`,
      [industryId],
    );

    return {
      segments,
      gaps: gaps.map(({ gap, companies }) => ({ gap, companies })),
      total_resumed: segments.reduce((a, r) => a + r.companies, 0),
    };
  });
}

/** その企業の配信本数に対応する再開セグメントを返す */
export function resumeSegmentFor(n, stats) {
  if (!stats?.segments?.length) return null;
  const seg = n <= 1 ? 1 : n <= 3 ? 2 : n <= 10 ? 3 : 4;
  return stats.segments.find((s) => s.seg === seg) || null;
}

// ─────────────────────────────────────────── 打ち手ごとの効果差分

/**
 * 「使うとこうなる」を出すための実測値。すべて同一業種内で算出する。
 * 情報通信での実測（2026-08-13）:
 *   メイン画像  あり 10.3% / なし 4.4%（2.3倍）
 *   キーワード  6件以上 10.8% / 0件 6.3%（1.7倍）
 *   タイトルの数字  あり 11.3% / なし 8.9%
 */
export async function getLevers(industryId) {
  if (USING_MOCK) return mock.mockLevers();

  return cached(`lever:${industryId}`, async () => {
    const rows = await query(
      `WITH peers AS (SELECT company_id FROM company WHERE industry_id = $1),
       rel AS (
         SELECT r.company_id, r.release_id, r.title, r.main_image,
                COALESCE(s.page_view, 0) AS pv
           FROM release r
           JOIN peers p ON p.company_id = r.company_id
           LEFT JOIN release_statistic s
                  ON s.company_id = r.company_id AND s.release_id = r.release_id
       ),
       thr AS (SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY pv) AS t FROM rel),
       kw AS (
         SELECT k.company_id, k.release_id, COUNT(*) AS cnt
           FROM release_keyword k
           JOIN rel ON rel.company_id = k.company_id AND rel.release_id = k.release_id
          GROUP BY 1, 2
       ),
       flat AS (
         SELECT 'main_image' AS lever,
                CASE WHEN rel.main_image IS NULL OR rel.main_image = '' THEN 'off' ELSE 'on' END AS variant,
                rel.pv
           FROM rel
         UNION ALL
         SELECT 'keyword',
                CASE WHEN COALESCE(kw.cnt, 0) >= 3 THEN 'on' ELSE 'off' END, rel.pv
           FROM rel LEFT JOIN kw
             ON kw.company_id = rel.company_id AND kw.release_id = rel.release_id
         UNION ALL
         SELECT 'title_number',
                CASE WHEN rel.title ~ '[0-9０-９]' THEN 'on' ELSE 'off' END, rel.pv
           FROM rel
         UNION ALL
         SELECT 'title_bracket',
                CASE WHEN rel.title LIKE '%【%' THEN 'on' ELSE 'off' END, rel.pv
           FROM rel
         UNION ALL
         SELECT 'location',
                CASE WHEN lo.release_id IS NULL THEN 'off' ELSE 'on' END, rel.pv
           FROM rel LEFT JOIN (SELECT DISTINCT company_id, release_id FROM release_location) lo
             ON lo.company_id = rel.company_id AND lo.release_id = rel.release_id
         UNION ALL
         -- カテゴリは「増やす」ことに意味が無い（1件10.9% / 2件10.2%）。
         -- 効くのは 0→1 だけ（0.4% → 10.9%）なので、有無だけで見る。
         SELECT 'category',
                CASE WHEN ca.release_id IS NULL THEN 'off' ELSE 'on' END, rel.pv
           FROM rel LEFT JOIN (SELECT DISTINCT company_id, release_id
                                 FROM release_business_category) ca
             ON ca.company_id = rel.company_id AND ca.release_id = rel.release_id
       )
       SELECT lever, variant, COUNT(*)::int AS n,
              ROUND(AVG(CASE WHEN pv >= (SELECT t FROM thr) THEN 1.0 ELSE 0 END) * 100, 1)::float AS hit_pct
         FROM flat GROUP BY 1, 2`,
      [industryId],
    );

    const out = {};
    for (const r of rows) {
      out[r.lever] ||= {};
      out[r.lever][r.variant] = { n: r.n, hit_pct: r.hit_pct };
    }
    for (const [k, v] of Object.entries(out)) {
      if (v.on && v.off && v.off.hit_pct > 0) {
        v.ratio = Math.round((v.on.hit_pct / v.off.hit_pct) * 10) / 10;
        v.n = v.on.n + v.off.n;
      }
    }
    return out;
  });
}

// ─────────────────────────────────────────── 短期の達成率

/**
 * 初回配信から3か月以内に、どこまで届いたか。
 * 情報通信での実測（2026-08-14 / 22,028社・平均2.3本）:
 *   1本でも50PV以上 12.5% / 200PV以上 2.4% / 1000PV以上 0.3%
 *
 * 「短期なら広告のほうがいい」を言い切らずに示すための材料。
 * 数字だけ出して、判断は相手に委ねる。
 */
export async function getAchievement(industryId) {
  if (USING_MOCK) return mock.mockAchievement();

  return cached(`achieve:${industryId}`, async () => {
    const [row] = await query(
      `WITH peers AS (SELECT company_id FROM company WHERE industry_id = $1),
       base AS (
         SELECT r.company_id, MIN(r.created_at) AS first_at
           FROM release r JOIN peers p ON p.company_id = r.company_id
          GROUP BY 1
       ),
       w AS (
         SELECT b.company_id,
                MAX(COALESCE(s.page_view, 0))::int AS best,
                COUNT(*)::int AS n
           FROM base b
           JOIN release r ON r.company_id = b.company_id
           LEFT JOIN release_statistic s
                  ON s.company_id = r.company_id AND s.release_id = r.release_id
          WHERE r.created_at < b.first_at + INTERVAL '3 months'
            AND b.first_at + INTERVAL '3 months' <= NOW()
          GROUP BY 1
       )
       SELECT COUNT(*)::int AS companies,
              ROUND(AVG(n), 1)::float AS avg_releases,
              ROUND(AVG(CASE WHEN best >=   50 THEN 1.0 ELSE 0 END) * 100, 1)::float AS pct_50,
              ROUND(AVG(CASE WHEN best >=  200 THEN 1.0 ELSE 0 END) * 100, 1)::float AS pct_200,
              ROUND(AVG(CASE WHEN best >= 1000 THEN 1.0 ELSE 0 END) * 100, 1)::float AS pct_1000
         FROM w`,
      [industryId],
    );
    return row || null;
  });
}

// ─────────────────────────────────────────── 未使用機能

export async function getUnusedFeatures(company) {
  if (USING_MOCK) return mock.mockUnused();

  const items = [];
  let levers = {};
  try { levers = await getLevers(company.industry_id); } catch { /* 効果差分は無くても動く */ }
  const impactOf = (key) => {
    const l = levers[key];
    if (!l?.on || !l?.off || !l.ratio) return null;
    return { metric: 'hit_pct', with: l.on.hit_pct, without: l.off.hit_pct, ratio: l.ratio, n: l.n };
  };
  try {
    const [f] = await query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE main_image IS NULL OR main_image = '')::int AS no_image,
              COUNT(*) FILTER (WHERE youtube_url IS NULL OR youtube_url = '')::int AS no_video,
              COUNT(*) FILTER (WHERE subtitle IS NULL OR subtitle = '')::int AS no_sub,
              COUNT(DISTINCT release_type_id)::int AS types
         FROM release WHERE company_id = $1`,
      [company.company_id],
    );

    const [k] = await query(
      `SELECT COALESCE(AVG(kw.cnt), 0)::float AS avg_keywords
         FROM release r
         LEFT JOIN (SELECT company_id, release_id, COUNT(*) AS cnt
                      FROM release_keyword GROUP BY company_id, release_id) kw
                ON kw.company_id = r.company_id AND kw.release_id = r.release_id
        WHERE r.company_id = $1`,
      [company.company_id],
    );

    if (!f || f.total === 0) return { items };

    if (k.avg_keywords < 3) {
      items.push({ key: 'keyword', label: 'キーワード設定',
        detected: `平均${k.avg_keywords.toFixed(1)}件`, impact: impactOf('keyword') });
    }
    if (f.no_image === f.total) {
      items.push({ key: 'main_image', label: 'メイン画像', detected: '未設定',
        impact: impactOf('main_image') });
    }
    if (f.no_sub === f.total) {
      items.push({ key: 'subtitle', label: 'サブタイトル', detected: '未設定', impact: null });
    }
    if (f.no_video === f.total) {
      items.push({ key: 'video', label: '動画の掲載', detected: '未設定', impact: null });
    }
    const [t] = await query(
      `SELECT COUNT(*) FILTER (WHERE title ~ '[0-9０-９]')::int AS with_num,
              COUNT(*) FILTER (WHERE title LIKE '%【%')::int AS with_br,
              COUNT(*)::int AS total
         FROM release WHERE company_id = $1`,
      [company.company_id],
    );
    if (t && t.with_num === 0) {
      items.push({ key: 'title_number', label: 'タイトルに数字を入れる',
        detected: '使っていない', impact: impactOf('title_number') });
    }
    if (t && t.with_br === 0) {
      items.push({ key: 'title_bracket', label: 'タイトルの【】',
        detected: '使っていない', impact: impactOf('title_bracket') });
    }

    if (f.types <= 1 && f.total >= 2) {
      items.push({ key: 'type', label: 'リリース種別の使い分け', detected: '1種類のみ', impact: null });
    }
  } catch (e) {
    console.error('[unused]', e.message);
  }
  return { items };
}

/** デモ対象を探す：配信が少なく、しばらく止まっている企業 */
export async function findStoppedCompanies(limit = 15) {
  if (USING_MOCK) return [];
  return query(
    `SELECT c.company_id, c.company_name, i.industry_name,
            t.n::int AS releases, t.last_at
       FROM (SELECT company_id, COUNT(*) AS n, MAX(created_at) AS last_at
               FROM release GROUP BY company_id
              HAVING COUNT(*) BETWEEN 1 AND 3
              LIMIT 20000) t
       JOIN company c ON c.company_id = t.company_id
       LEFT JOIN industry i ON i.industry_id = c.industry_id
      WHERE t.last_at < NOW() - INTERVAL '9 months'
      ORDER BY t.last_at DESC
      LIMIT $1`,
    [limit],
  );
}
