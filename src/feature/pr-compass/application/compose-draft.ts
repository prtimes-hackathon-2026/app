import {
  INTEREST_SUGGESTIONS,
  OBJECTION_PLAYBOOK,
  REASON_SUGGESTIONS,
  type ConversationState,
  type Interest,
  type Reason,
} from '../domain/conversation'
import type { Block } from '../domain/block'
import { bucketOf, type Insight } from '../domain/insight'

/**
 * 各段の下書きと、そこで示す事実。
 *
 * ここに出てくる数値はすべて統計 DB の集計結果で、文章側で作った数字は無い。
 * Narrator はこの下書きを言い換えるだけで、数値を足すことも消すこともしない。
 */
export type Draft = {
  draft: string
  facts: Record<string, string>
  /** 本文に添えるサジェスト。入力は縛らない */
  suggestions?: readonly string[]
  /** 数値を描く部品。本文とは別に画面へ渡す */
  blocks?: readonly Block[]
}

const pct = (n: number) => `${n}%`
const jp = (n: number) => n.toLocaleString('ja-JP')

/**
 * サジェストは本文に混ぜず、別に返して画面側でチップとして出す。
 * 文中に「/」区切りで並べると読みにくいうえ、選択式に見えてしまう。
 */

// ─────────────────────────────────────────── ①診断

/**
 * 最初の一言で価値を返す。相手が何も答えていない時点で、
 * 知らなかった事実を渡してから1つだけ問う。
 */
export function composeDiagnosis(insight: Insight): Draft {
  const { diagnosis: d, hitCurve, resume } = insight
  const mine = hitCurve?.buckets.find(
    (b) => b.bucket === bucketOf(d.totalReleases),
  )
  const top = hitCurve?.buckets[hitCurve.buckets.length - 1]
  const lastTitle = d.recentTitles[0]

  const lines: string[] = []
  lines.push(
    `${d.companyName}さんの状況を確認しました。配信は${d.totalReleases}本で、` +
      (d.stoppedMonths !== null
        ? `そこから${d.stoppedMonths}か月止まっています。`
        : 'その後が続いていません。'),
  )

  if (mine && top) {
    lines.push(
      `同じ${d.industryName}で${mine.bucket}だけ配信した企業のうち、手応えのある結果に届いたのは${pct(mine.hitPct)}でした。` +
        `反応が無かったのは、御社に問題があったからではありません。`,
    )
    lines.push(
      `1本あたりの反応は本数を重ねても平均は変わりませんが、当たり外れの幅がとても大きく、` +
        `${top.bucket}まで続けた企業では${pct(top.hitPct)}が当たりを引いています。本数がそのまま確率になります。`,
    )
  }

  if (resume) {
    lines.push(
      `そして御社と同じところで止まっていた企業のうち、${jp(resume.companies)}社が配信を再開しています。` +
        `再開前は${pct(resume.hitBeforePct)}でしたが、再開後は${pct(resume.hitAfterPct)}まで上がりました。` +
        `追加した本数は中央値で${resume.addedMedian}本です。`,
    )
  }

  lines.push(
    lastTitle
      ? `前回「${lastTitle.slice(0, 40)}」を出されてから止まっていますが、何が引っかかりましたか。`
      : `そのうえで伺いたいのですが、配信が止まったのは何が引っかかったからでしょうか。`,
  )

  const facts: Record<string, string> = {
    会社名: d.companyName,
    業種: d.industryName,
    御社の配信本数: `${d.totalReleases}本`,
    停止期間: d.stoppedMonths !== null ? `${d.stoppedMonths}か月` : '不明',
  }
  if (mine) facts['御社と同じ本数の企業が当たりを引いた割合'] = pct(mine.hitPct)
  if (top)
    facts['最も多く配信している企業群の当たり率'] =
      `${pct(top.hitPct)}（${top.bucket}）`
  if (hitCurve) {
    facts['同じ業種の企業数'] = `${jp(hitCurve.totalCompanies)}社`
    facts['手応えのある結果の基準'] =
      `${hitCurve.thresholdPv}PV以上（業種内の上位10%）`
  }
  if (resume) {
    facts['同じところで止まってから再開した企業'] = `${jp(resume.companies)}社`
    facts['再開後の当たり率'] = pct(resume.hitAfterPct)
    facts['再開後に追加した本数の中央値'] = `${resume.addedMedian}本`
  }
  if (lastTitle) facts['前回のリリース'] = lastTitle

  const blocks: Block[] = [
    {
      type: 'stat',
      items: [
        { label: 'これまでの配信', value: `${d.totalReleases}本` },
        {
          label: '最終配信からの経過',
          value: d.stoppedMonths !== null ? `${d.stoppedMonths}か月` : '—',
        },
      ],
    },
  ]

  if (hitCurve) {
    blocks.push({
      type: 'bars',
      title: '配信本数と、手応えのある結果に届いた企業の割合',
      unit: '%',
      items: hitCurve.buckets.map((b) => ({
        label: b.bucket,
        value: b.hitPct,
      })),
      highlight: bucketOf(d.totalReleases),
      note: `${d.industryName} ${jp(hitCurve.totalCompanies)}社。「手応えのある結果」＝1本でも ${hitCurve.thresholdPv}PV以上（業種内の上位10%）に届いたこと`,
    })
  }

  if (resume) {
    blocks.push({
      type: 'compare',
      title: '同じところで止まってから再開した企業',
      left: { label: '再開前', value: pct(resume.hitBeforePct) },
      right: { label: '再開後', value: pct(resume.hitAfterPct) },
      note: `${jp(resume.companies)}社。追加した本数は中央値で${resume.addedMedian}本`,
    })
  }

  return {
    draft: lines.join('\n\n'),
    facts,
    blocks,
    suggestions: Object.values(REASON_SUGGESTIONS),
  }
}

// ─────────────────────────────────────────── ②止まった理由への処方

/** 理由によって処方を変える。ここが無いと全員に同じ話をすることになる */
export function composeReason(insight: Insight, reason: Reason): Draft {
  const { diagnosis: d, hitCurve, resume, period, levers, trends } = insight
  const facts: Record<string, string> = {
    止まった理由: REASON_SUGGESTIONS[reason],
  }
  const lines: string[] = []

  if (reason === 'no_effect') {
    const mine = hitCurve?.buckets.find(
      (b) => b.bucket === bucketOf(d.totalReleases),
    )
    lines.push(
      `反応が無かったのは、たしかに気持ちが折れます。ただ数字を見ると、${d.totalReleases}本の時点で手応えに届く企業は${pct(mine?.hitPct ?? 0)}しかいません。` +
        `${d.totalReleases}本で判断するには早すぎる、というのが実態です。`,
    )
    if (mine) facts['その本数での当たり率'] = pct(mine.hitPct)
  } else if (reason === 'no_topic') {
    const common = [...trends].sort((a, b) => b.n - a.n)[0]
    const best = trends[0]
    if (common && best && common.name !== best.name) {
      lines.push(
        `ネタが無いというより、出し方の問題かもしれません。${d.industryName}で最も多く出されているのは「${common.name}」で${jp(common.n)}本あります。` +
          `数が多いぶん埋もれやすく、跳ねたときでも${common.pvP90}PVどまりです。一方「${best.name}」の形は${best.pvP90}PVまで伸びています。`,
      )
      facts['最も多く出されている種別'] =
        `${common.name}（${jp(common.n)}本・跳ねたとき${common.pvP90}PV）`
      facts['最も跳ねやすい種別'] = `${best.name}（跳ねたとき${best.pvP90}PV）`
    }
  } else if (reason === 'no_time') {
    const target = resume?.addedMedian ?? 3
    lines.push(
      `時間が取れないのであれば、頻度を落とす前提で組み立てましょう。目標は${target}本です。` +
        `3か月に1本のペースでも${target * 3}か月で届きます。毎月出す必要はありません。`,
    )
    facts['目標の本数'] = `${target}本`
    facts['3か月に1本のペースでかかる期間'] = `${target * 3}か月`
  } else if (reason === 'handover') {
    lines.push(
      `引き継ぎでしたか。前任の方が何を出していたかは残っているので、そこからお伝えします。` +
        `直近は「${d.recentTitles[0]?.slice(0, 36) ?? '（記録なし）'}」でした。ゼロから考え直す必要はありません。`,
    )
    facts['直近のリリース'] = d.recentTitles[0] ?? '—'
  } else {
    const last = period[period.length - 1]
    if (last) {
      lines.push(
        `特にきっかけが無いまま止まる、というのが実は一番多い形です。${d.industryName}では初回配信から3年経った企業でも当たりを引いていたのは${pct(last.hitPct)}で、` +
          `中央値の企業は3年で${last.releasesMedian}本しか出していません。時間ではなく本数が効きます。`,
      )
      facts['3年経過時点の当たり率'] = pct(last.hitPct)
      facts['3年経過時点の配信本数の中央値'] = `${last.releasesMedian}本`
    }
  }

  const worst = levers.find((l) => insight.unused.some((u) => u.key === l.key))
  if (worst) {
    lines.push(
      `もう一点、御社のリリースでは${worst.label}が使われていません。${d.industryName}では、使っているものが${pct(worst.withPct)}、使っていないものが${pct(worst.withoutPct)}という差が出ています。`,
    )
    facts[`${worst.label}を使っているリリース`] = pct(worst.withPct)
    facts[`${worst.label}を使っていないリリース`] = pct(worst.withoutPct)
  }

  lines.push(`そのうえで、いま一番やりたいことはどれに近いですか。`)

  const blocks: Block[] = []
  if (worst) {
    blocks.push({
      type: 'compare',
      title: `${worst.label}を使っているかどうか`,
      left: { label: '使っていない', value: pct(worst.withoutPct) },
      right: { label: '使っている', value: pct(worst.withPct) },
      note: `${d.industryName} ${jp(worst.samples)}本の実績。差があるという事実で、使えば上がるという意味ではない`,
    })
  }
  if (reason === 'none' && period.length) {
    blocks.push({
      type: 'table',
      title: '時間をかけるだけでは上がらない',
      columns: ['初回からの経過', '当たり率', '配信本数の中央値'],
      rows: period.map((r) => [
        `${r.months}か月`,
        pct(r.hitPct),
        `${r.releasesMedian}本`,
      ]),
    })
  }

  return {
    draft: lines.join('\n\n'),
    facts,
    blocks,
    suggestions: Object.values(INTEREST_SUGGESTIONS),
  }
}

// ─────────────────────────────────────────── ③提案

/** 目標・時間の話・出し方・機能を一度に出す。分割しない */
export function composeProposal(insight: Insight, interest: Interest): Draft {
  const { diagnosis: d, resume, period, trends, levers } = insight
  const target = resume?.addedMedian ?? 3
  const lines: string[] = []
  const facts: Record<string, string> = {
    やりたいこと: INTEREST_SUGGESTIONS[interest],
    目標の本数: `${target}本`,
  }

  if (resume) {
    lines.push(
      `まず${target}本を目標にしましょう。同じところで止まってから再開した${jp(resume.companies)}社が、中央値で${target}本を追加し、${pct(resume.hitAfterPct)}が手応えのある結果に届いています。` +
        `月1本なら${target}か月、3か月に1本でも${target * 3}か月で届く範囲です。`,
    )
    facts['再開した企業'] = `${jp(resume.companies)}社`
    facts['再開後の当たり率'] = pct(resume.hitAfterPct)
  }

  const last = period[period.length - 1]
  if (last) {
    lines.push(
      `逆に、時間をかけるだけでは上がりません。3年経った企業でも当たりを引いていたのは${pct(last.hitPct)}で、中央値の企業は3年で${last.releasesMedian}本しか出していないからです。`,
    )
    facts['3年経過時点の当たり率'] = pct(last.hitPct)
  }

  const common = [...trends].sort((a, b) => b.n - a.n)[0]
  const best = trends[0]
  if (common && best && common.name !== best.name) {
    const head = d.recentTitles[0]
      ? `御社が出された「${d.recentTitles[0].slice(0, 26)}」のような`
      : ''
    lines.push(
      `${head}${common.name}の告知は、この業種で最も多く出されている形です（${jp(common.n)}本）。数が多いぶん埋もれやすく、跳ねたときの水準も${common.pvP90}PVにとどまります。` +
        `一方「${best.name}」の形は${best.pvP90}PVまで伸びています。商品を別のものに変えるという話ではなく、商品そのものを説明する前に、その商品が解決している問題のほうを先に出す、という順番の違いです。`,
    )
    facts['最も跳ねやすい種別'] = `${best.name}（跳ねたとき${best.pvP90}PV）`
  }

  const lever =
    levers.find((l) => insight.unused.some((u) => u.key === l.key)) ?? levers[0]
  if (lever) {
    lines.push(
      `出すときは${lever.label}を入れてください。${d.industryName}では、使っているリリースが${pct(lever.withPct)}、使っていないものが${pct(lever.withoutPct)}という差が出ています（${jp(lever.samples)}本の実績）。`,
    )
    facts[`${lever.label}の差`] =
      `${pct(lever.withPct)} / ${pct(lever.withoutPct)}`
  }

  lines.push(
    `この方向で進めてよさそうでしょうか。気になるところがあれば教えてください。`,
  )

  const blocks: Block[] = [
    {
      type: 'goal',
      headline: `あと${target}本`,
      detail: resume
        ? `同じところから再開した${jp(resume.companies)}社の中央値。ここまでで ${pct(resume.hitAfterPct)} が手応えのある結果に届いています`
        : `月1本なら${target}か月、3か月に1本でも${target * 3}か月`,
    },
  ]

  if (period.length) {
    blocks.push({
      type: 'table',
      title: '時間をかけるだけでは上がらない',
      columns: ['初回からの経過', '当たり率', '配信本数の中央値'],
      rows: period.map((r) => [
        `${r.months}か月`,
        pct(r.hitPct),
        `${r.releasesMedian}本`,
      ]),
      note: '中央値の企業は3年かけても数本しか出していない',
    })
  }

  if (trends.length) {
    blocks.push({
      type: 'table',
      title: 'どの種類のリリースが跳ねやすいか',
      columns: ['種別', '跳ねたとき', '中央値', '件数'],
      rows: trends.map((t) => [
        t.name,
        t.pvP90 !== null ? `${t.pvP90}PV` : '—',
        t.pvP50 !== null ? `${t.pvP50}PV` : '—',
        jp(t.n),
      ]),
      note: '中央値ではほとんど差がつかない。跳ねたときの水準で見る',
    })
  }

  return {
    draft: lines.join('\n\n'),
    facts,
    blocks,
    suggestions: [
      'この方向で書いてみる',
      '書き方をもっと見たい',
      '社内で通せるか不安',
      'ピンとこない',
      '効果が出るか半信半疑',
    ],
  }
}

// ─────────────────────────────────────────── ④反応への応答

/** 主導線。会話の目的は納得させることではなく、1本書いてもらうこと */
export function composeWriteGuide(insight: Insight, interest: Interest): Draft {
  const { diagnosis: d, resume, levers, unused } = insight
  const target = resume?.addedMedian ?? 3
  const checks = unused
    .map((u) => {
      const l = levers.find((x) => x.key === u.key)
      return l
        ? `・${l.label}（使っているリリース ${pct(l.withPct)} / 使っていないもの ${pct(l.withoutPct)}）`
        : `・${u.label}`
    })
    .slice(0, 4)

  const facts: Record<string, string> = {
    目標の本数: `${target}本`,
    やりたいこと: INTEREST_SUGGESTIONS[interest],
  }
  for (const u of unused) {
    const l = levers.find((x) => x.key === u.key)
    if (l) facts[`${l.label}の差`] = `${pct(l.withPct)} / ${pct(l.withoutPct)}`
  }

  return {
    draft:
      `では書きにいきましょう。まず1本目です。\n\n` +
      `出す前に確認しておくとよいのはこの点です。\n${checks.join('\n')}\n\n` +
      `${d.industryName}の実績なので、御社のリリースにもそのまま当てはまります。\n\n` +
      `書けたら教えてください。結果を見て、次の1本を一緒に決めます。${target}本までは伴走します。`,
    facts,
    blocks: [
      { type: 'goal', headline: `あと${target}本`, detail: 'まず1本目から' },
      {
        type: 'checklist',
        title: '出す前に確認すること',
        items: unused.map((u) => {
          const l = levers.find((x) => x.key === u.key)
          return l
            ? { label: l.label, withPct: l.withPct, withoutPct: l.withoutPct }
            : { label: u.label }
        }),
        note: `${d.industryName}の実績。「使うと上がる」ではなく「使っているリリースは差がある」という意味`,
      },
    ],
  }
}

/** 止まる原因の多くは意欲ではなく、社内で時間を確保できないこと */
export function composeBossSheet(insight: Insight): Draft {
  const { diagnosis: d, hitCurve, resume, period } = insight
  const mine = hitCurve?.buckets.find(
    (b) => b.bucket === bucketOf(d.totalReleases),
  )
  const top = hitCurve?.buckets[hitCurve.buckets.length - 1]
  const last = period[period.length - 1]

  const facts: Record<string, string> = {}
  const rows: string[] = []
  if (mine && top) {
    rows.push(
      `・${mine.bucket}で手応えに届いた企業は${pct(mine.hitPct)}、${top.bucket}まで続けた企業は${pct(top.hitPct)}`,
    )
    facts['現在地の当たり率'] = pct(mine.hitPct)
    facts['続けた企業の当たり率'] = pct(top.hitPct)
  }
  if (resume) {
    rows.push(
      `・同じところから再開した企業は${jp(resume.companies)}社。追加は中央値${resume.addedMedian}本で、${pct(resume.hitAfterPct)}が手応えに届いた`,
    )
    facts['再開した企業'] = `${jp(resume.companies)}社`
  }
  if (last) {
    rows.push(
      `・時間をかけるだけでは上がらない。3年経過時点でも${pct(last.hitPct)}、中央値の企業は3年で${last.releasesMedian}本`,
    )
  }
  if (hitCurve) {
    rows.push(
      `（いずれも${d.industryName}${jp(hitCurve.totalCompanies)}社の実績。「手応えのある結果」＝${hitCurve.thresholdPv}PV以上）`,
    )
  }

  return {
    draft:
      `そのまま転送できる形にしました。\n\n` +
      `${d.companyName}／広報の再開について\n${rows.join('\n')}\n\n` +
      `提案：まず${resume?.addedMedian ?? 3}本。月1本なら${resume?.addedMedian ?? 3}か月です。\n\n` +
      `主観は入れていないので、判断材料としてそのまま出せます。これで話は通りそうですか。`,
    facts,
    blocks: [
      {
        type: 'stat',
        items: [
          ...(mine ? [{ label: '現在地', value: pct(mine.hitPct) }] : []),
          ...(top ? [{ label: '続けた企業', value: pct(top.hitPct) }] : []),
          ...(resume
            ? [{ label: '再開後', value: pct(resume.hitAfterPct) }]
            : []),
          { label: '提案する目標', value: `あと${resume?.addedMedian ?? 3}本` },
        ],
      },
    ],
  }
}

/** 疑いは正当。押し返さず、材料を足す */
export function composeDoubt(insight: Insight): Draft {
  const { achievement: a, levers } = insight
  const facts: Record<string, string> = {}
  const lines: string[] = []

  if (a) {
    lines.push(
      `疑うのは当然だと思います。数字をそのまま出します。初回配信から3か月以内に、1本でも50PV以上に届いた企業は${a.pct50}%、200PV以上は${a.pct200}%、1000PV以上になると${a.pct1000}%です（${jp(a.companies)}社・平均${a.avgReleases}本）。`,
    )
    lines.push(
      `つまり短期で大きく跳ねるのは、ほとんど起きていません。3か月で確実な数字が必要なら、広告など別の手段のほうが向いています。`,
    )
    facts['3か月以内に50PV以上'] = `${a.pct50}%`
    facts['3か月以内に200PV以上'] = `${a.pct200}%`
    facts['3か月以内に1000PV以上'] = `${a.pct1000}%`
  }

  const img = levers.find((l) => l.key === 'main_image')
  if (img) {
    lines.push(
      `一方で、同じ企業の中で${img.label}を使い始めた前後を比べると差が出ています（${pct(img.withPct)} / ${pct(img.withoutPct)}）。効くのは短期の爆発ではなく、こういう積み上げのほうです。`,
    )
  }

  lines.push(`このうえで、どうされますか。`)

  const blocks: Block[] = []
  if (a) {
    blocks.push({
      type: 'table',
      title: '3か月以内にどこまで届いたか',
      columns: ['目標', '達成した企業'],
      rows: [
        ['1本でも50PV以上', `${a.pct50}%`],
        ['1本でも200PV以上', `${a.pct200}%`],
        ['1本でも1000PV以上', `${a.pct1000}%`],
      ],
      note: `${jp(a.companies)}社・平均${a.avgReleases}本。短期で大きく跳ねるのはほとんど起きていない`,
    })
  }
  if (img) {
    blocks.push({
      type: 'compare',
      title: `${img.label}を使い始めた前後（同じ企業の中で比較）`,
      left: { label: '使う前', value: pct(img.withoutPct) },
      right: { label: '使った後', value: pct(img.withPct) },
    })
  }

  return { draft: lines.join('\n\n'), facts, blocks }
}

/** 断られるたびに引き出しを変える。同じ提案の言い換えを繰り返さない */
export function composeAlternative(
  insight: Insight,
  state: ConversationState,
): Draft {
  const { trends, diagnosis: d } = insight
  const move =
    OBJECTION_PLAYBOOK[
      Math.min(state.objections - 1, OBJECTION_PLAYBOOK.length - 1)
    ]
  const facts: Record<string, string> = {
    断られた回数: `${state.objections}回`,
  }
  const lines: string[] = []

  if (state.objections === 1) {
    const alt = trends[1] ?? trends[0]
    if (alt) {
      lines.push(
        `わかりました。切り口を変えましょう。${d.industryName}では「${alt.name}」の形も跳ねやすく、上位10%で${alt.pvP90}PVです。`,
      )
      facts['別の切り口'] = `${alt.name}（跳ねたとき${alt.pvP90}PV）`
    }
    lines.push(
      `届けたい相手が違う、ということはありませんか。いま届いている相手と、届けたい相手は同じでしょうか。`,
    )
  } else if (state.objections === 2) {
    lines.push(
      `では、もっと軽い形にしましょう。新しく書き起こさなくても、既にある素材（過去のリリース・社内の資料・お客様の声）を組み直すだけで1本になります。`,
    )
    lines.push(
      `手間が理由なのであれば、そこを削るところから始めるのが早いです。どのあたりが重いですか。`,
    )
  } else {
    lines.push(
      `提案を重ねるより、実例を見ていただくほうが早そうです。同じ${d.industryName}の企業が実際に出したものを見て、近いものがあるか教えてください。`,
    )
  }

  if (move) facts['次に試すこと'] = move
  return { draft: lines.join('\n\n'), facts }
}

/** ここまで届かないなら対話では解けない */
export function composeHandoff(
  insight: Insight,
  state: ConversationState,
): Draft {
  const { diagnosis: d, resume } = insight
  return {
    draft:
      `ここから先は、御社の事情を踏まえて詰めたほうが早いと思います。担当者におつなぎしましょうか。\n\n` +
      `お渡しするのは、いまの状況（${d.totalReleases}本・${d.stoppedMonths ?? '—'}か月停止）、` +
      `止まった理由、ここまでで合わなかった提案とその理由です。同じ話を最初からしていただく必要はありません。`,
    facts: {
      配信本数: `${d.totalReleases}本`,
      停止期間: d.stoppedMonths !== null ? `${d.stoppedMonths}か月` : '不明',
      合わなかった提案の回数: `${state.objections}回`,
      目標の本数: `${resume?.addedMedian ?? 3}本`,
    },
  }
}
