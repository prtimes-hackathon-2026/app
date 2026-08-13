import {
  bucketOf, getCompany, getHistory, getHitCurve, getPeriodCurve, getResumeStats,
  getTrends, getUnusedFeatures, resumeSegmentFor,
} from './metrics.js';
import { ARTICLES, FEATURES, INTERESTS, INTEREST_LABEL } from './catalog.js';
import { narrate } from './narrate.js';
import { script0, script1 } from './script.js';

/** ターン0 — 何も聞かずに、診断・傾向・現在地・未使用機能を出す */
export async function buildTurn0(companyId) {
  const company = await getCompany(companyId);
  if (!company) return { error: 'company_not_found' };

  const [history, hit, unused, resume] = await Promise.all([
    getHistory(companyId),
    getHitCurve(company.industry_id),
    getUnusedFeatures(company),
    getResumeStats(company.industry_id),
  ]);
  const seg = resumeSegmentFor(history.total_releases, resume);
  const longGap = resume?.gaps?.find((g) => g.gap === '2年以上');

  const myBucket = bucketOf(history.total_releases);
  const here = hit?.buckets.find((b) => b.bucket === myBucket);
  const top = hit?.buckets[hit.buckets.length - 1];

  const draft = {
    position: history.total_releases <= 3
      ? `御社は${history.total_releases}本で止まっています。同じ業種で${myBucket}だけ配信した企業のうち、手応えのある結果に届いたのは${here?.hit_pct ?? '—'}%でした。反応が無かったのは、御社に問題があったからではありません。`
      : `御社はこれまで${history.total_releases}本を配信しています。同じ業種の${myBucket}の企業では${here?.hit_pct ?? '—'}%が手応えのある結果に届いています。`,
    lottery: hit
      ? `1本あたりの反応は本数を重ねても平均は変わりませんが、当たり外れの幅がとても大きいという特徴があります。${top.bucket}まで続けた企業では${top.hit_pct}%が当たりを引いています。本数がそのまま確率になります。`
      : '',
    resume: seg
      ? `そして御社と同じく${seg.from_n === seg.to_n ? `${seg.from_n}本` : `${seg.from_n}〜${seg.to_n}本`}で止まっていた企業のうち、${seg.companies.toLocaleString()}社が配信を再開しています。再開前の当たり率は${seg.hit_before_pct}%でしたが、再開後は${seg.hit_after_pct}%まで上がりました。追加した本数は中央値で${seg.added_p50}本です。`
      : '',
  };

  const facts = {
    '御社の配信本数': `${history.total_releases}本`,
    '停止期間': history.stopped_months !== null ? `${history.stopped_months}か月` : '不明',
    '業種': company.industry_name || '不明',
    '同じ業種の企業数': hit ? `${hit.total_companies.toLocaleString()}社` : '—',
    '御社と同じ本数の企業が当たりを引いた割合': here ? `${here.hit_pct}%` : '—',
    '最も多く配信している企業群の当たり率': top ? `${top.hit_pct}%（${top.bucket}）` : '—',
    '手応えのある結果の基準': hit ? `${hit.threshold_pv}PV以上（業種内の上位10%）` : '—',
    '同じ本数で止まってから再開した企業数': seg ? `${seg.companies.toLocaleString()}社` : '—',
    '再開前の当たり率': seg ? `${seg.hit_before_pct}%` : '—',
    '再開後の当たり率': seg ? `${seg.hit_after_pct}%` : '—',
    '再開後に追加した本数の中央値': seg ? `${seg.added_p50}本` : '—',
    '2年以上あけてから再開した企業数': longGap ? `${longGap.companies.toLocaleString()}社` : '—',
  };

  const { text, source } = await narrate({ facts, draft });

  const out = {
    turn: 0,
    company: {
      id: company.company_id, name: company.company_name,
      industry: company.industry_name,
    },
    blocks: [
      {
        type: 'diagnosis', title: '現在地',
        facts: {
          total_releases: history.total_releases,
          stopped_months: history.stopped_months,
          last_released_at: history.last_released_at,
          recent: history.recent,
        },
      },
      hit && {
        type: 'hitcurve', title: '配信本数と、手応えのある結果に届いた企業の割合',
        buckets: hit.buckets, mine: myBucket,
        threshold_pv: hit.threshold_pv,
        evidence: { companies: hit.total_companies, axes: [company.industry_name || '業種'] },
      },
      seg && {
        type: 'resume', title: '同じところで止まって、戻ってきた企業',
        segment: seg, gaps: resume.gaps, total: resume.total_resumed,
      },
      unused.items.length && { type: 'unused_features', title: '使われていない機能', items: unused.items },
    ].filter(Boolean),
    narrative: { ...text, source },
    question: {
      id: 'interest', text: 'どれから手を付けますか？',
      options: [...INTERESTS, { id: 'other', label: 'その他' }],
    },
  };

  return { ...out, speech: script0(out) };
}

/**
 * 種別の傾向を、その企業の商品に接続した文にする。
 * 「この業種では調査レポートが跳ねる」だけでは、商品の話が消えて他人事になる。
 * 障害（埋もれる）→ 仕組み（入り口を変える）→ 数字、の順に書く。
 */
function bridgeDraft(trends, best, history) {
  const common = [...trends.items].sort((a, b) => b.n - a.n)[0];
  const title = history.recent?.[0]?.title;
  const head = title ? `御社が出された「${title.slice(0, 30)}…」のような` : '';

  if (!common || common.release_type_name === best.release_type_name) {
    return `同じ業種では「${best.release_type_name}」の形が最も大きく跳ねており、跳ねたときの水準は${best.pv_p90}PVでした。`;
  }
  return `${head}${common.release_type_name}の告知は、この業種で最も多く出されている形です（${common.n.toLocaleString()}本）。`
    + `数が多いぶん埋もれやすく、跳ねたときの水準も${common.pv_p90}PVにとどまります。`
    + `一方「${best.release_type_name}」の形は${best.pv_p90}PVまで伸びています。`
    + `商品を別のものに変えるという話ではなく、商品そのものを説明する前に、`
    + `その商品が解決している問題のほうを先に出す、という順番の違いです。`;
}

/** ターン1 — 選んだ関心に沿って、見込み・傾向・機能を一度に返す */
export async function buildTurn1(companyId, interest) {
  const company = await getCompany(companyId);
  if (!company) return { error: 'company_not_found' };

  const [history, hit, trends, period, resume] = await Promise.all([
    getHistory(companyId),
    getHitCurve(company.industry_id),
    getTrends(company.industry_id),
    getPeriodCurve(company.industry_id),
    getResumeStats(company.industry_id),
  ]);
  const seg = resumeSegmentFor(history.total_releases, resume);

  const now = history.total_releases;
  const here = hit?.buckets.find((b) => b.bucket === bucketOf(now));
  // 「あと何本でどこまで上がるか」をペースに換算する
  const steps = [3, 5, 10, 20]
    .filter((n) => n > now)
    .map((n) => {
      const b = hit?.buckets.find((x) => x.bucket === bucketOf(n));
      return {
        target: n, need: n - now, hit_pct: b?.hit_pct ?? null,
        months_monthly: n - now,
        months_quarterly: (n - now) * 3,
      };
    })
    .filter((s) => s.hit_pct !== null);

  const key = FEATURES[interest] ? interest : 'topic';
  const bestType = trends.items[0];
  // 「最も多く出されている＝埋もれやすい」形を特定する
  const mostCommon = [...trends.items].sort((a, b) => b.n - a.n)[0];

  const draft = {
    outlook: seg
      ? `まず${seg.added_p50}本を目標にしてください。同じところで止まってから再開した${seg.companies.toLocaleString()}社が、中央値で${seg.added_p50}本を追加し、${seg.hit_after_pct}%が手応えのある結果に届いています。月1本なら${seg.added_p50}か月、3か月に1本でも${seg.added_p50 * 3}か月で届く範囲です。`
      : (steps.length
        ? `いまは${now}本で${here?.hit_pct ?? '—'}%の地点です。あと${steps[0].need}本で${steps[0].hit_pct}%まで上がります。`
        : `すでに十分な本数を配信しています。`),
    time: period?.rows?.length
      ? `ただし時間をかけるだけでは上がりません。同じ業種で初回配信から3年経った企業でも、当たりを引いていたのは${period.rows[period.rows.length - 1].hit_pct}%です。中央値の企業は3年で${period.rows[period.rows.length - 1].releases_p50}本しか配信していません。`
      : '',
    trend: bestType ? bridgeDraft(trends, bestType, history) : '',
    feature: `${INTEREST_LABEL[interest] || 'この目的'}であれば、${FEATURES[key][0].name}が使えます。`,
  };

  const facts = {
    '現在の配信本数': `${now}本`,
    '現在の当たり率': here ? `${here.hit_pct}%` : '—',
    ...Object.fromEntries(steps.map((s) => [`${s.target}本まで出した場合の当たり率`, `${s.hit_pct}%`])),
    '3年経過時点の当たり率': period?.rows?.length ? `${period.rows[period.rows.length - 1].hit_pct}%` : '—',
    '3年経過時点の配信本数の中央値': period?.rows?.length ? `${period.rows[period.rows.length - 1].releases_p50}本` : '—',
    '最も跳ねやすい種別': bestType ? `${bestType.release_type_name}（跳ねたとき${bestType.pv_p90}PV）` : '—',
    '最も多く出されている種別': mostCommon
      ? `${mostCommon.release_type_name}（${mostCommon.n.toLocaleString()}本・跳ねたとき${mostCommon.pv_p90}PV）` : '—',
    '御社が実際に出したリリース': history.recent?.[0]?.title || '—',
    '御社の事業内容': (company.description || '').slice(0, 160) || '—',
    '選ばれた関心': INTEREST_LABEL[interest] || interest,
  };

  const { text, source } = await narrate({ facts, draft });

  const out = {
    turn: 1,
    blocks: [
      { type: 'outlook', title: '目標',
        facts: { now, current_pct: here?.hit_pct ?? null, steps, resume_target: seg } },
      period?.rows?.length && {
        type: 'period', title: '時間をかけるだけでは上がらない',
        rows: period.rows,
      },
      trends.items.length && { type: 'trends', title: 'どの種類のリリースが跳ねやすいか', items: trends.items },
      {
        type: 'features', title: '使うとよい機能',
        items: FEATURES[key], articles: ARTICLES[key] || [],
      },
    ].filter(Boolean),
    narrative: { ...text, source },
    question: {
      id: 'next', text: 'この方向で進めますか？',
      options: [
        { id: 'ok', label: 'この方向でいく' },
        { id: 'back', label: '別の関心を選び直す' },
      ],
    },
  };

  return { ...out, speech: script1(out) };
}
