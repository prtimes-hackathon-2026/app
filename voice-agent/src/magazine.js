/**
 * PR TIMES MAGAZINE の記事を、対話の分岐に合わせて選ぶ。
 *
 * 埋め込み（ベクトル検索）は使わない。理由は3つ:
 *   ・マガジン側に purpose / level という既製の分類があり、分岐にそのまま対応する
 *   ・「なぜこの記事を出したか」を説明できる必要がある（推薦理由を画面に出す）
 *   ・1,188件なら全件スコアリングしても一瞬で終わる
 *
 * 収集は scrape_magazine.mjs（RSSではなく __NEXT_DATA__ から。RSSは最新10件しか返らない）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SITE = 'https://prtimes.com/magazine'

let ARTICLES = []
try {
  const raw = fs.readFileSync(path.join(HERE, '..', 'magazine.json'), 'utf8')
  ARTICLES = JSON.parse(raw).articles || []
} catch {
  // 未収集でも動く。記事が出ないだけ
}

export const READY = ARTICLES.length > 0
export const COUNT = ARTICLES.length

/** 会話の分岐 → マガジン側の分類 */
const BRANCH = {
  // 止まった理由（ターン0.5）
  reason_no_topic: {
    purposes: ['広報PRの情報発信を充実させたい'],
    want: ['ネタ', 'テンプレート', '書き方', '事例'],
  },
  reason_no_time: {
    levels: ['ビギナー'],
    want: ['テンプレート', '効率', 'STEP', '時短'],
  },
  reason_no_effect: {
    purposes: ['広報PR活動をブラッシュアップ'],
    must: ['効果', '分析', '改善', '読まれ', 'データ'],
  },
  reason_handover: {
    levels: ['イントロダクション'],
    must: ['新任', '異動', '退職', '引き継', '担当者になったら', 'アカウント'],
  },
  reason_none: { levels: ['イントロダクション'], want: [] },

  // 関心（ターン1）
  pv: {
    purposes: ['広報PR活動をブラッシュアップ'],
    must: ['効果', '読まれ', 'タイトル', '画像', '改善', 'PV'],
  },
  media: {
    purposes: ['ワンランク上の広報PRを目指したい'],
    must: ['メディア', '記者', '取材', '掲載', 'テレビ', '新聞', '雑誌'],
  },
  story: {
    purposes: ['参考にしたい他社の成功事例'],
    must: ['ストーリー', '想い', '背景', 'インタビュー', '創業', 'STORY'],
  },
  topic: {
    purposes: ['参考にしたい他社の成功事例'],
    want: ['テンプレート', '事例', '書き方'],
  },
}

/** 業種名 → タイトルに出てくる語 */
const INDUSTRY_WORDS = {
  情報通信: ['ソフトウェア', 'アプリ', 'IT', 'SaaS', 'システム', 'Web'],
  製造業: ['製造', 'メーカー', '工場', '新製品'],
  '商業（卸売業、小売業）': ['小売', 'EC', '店舗', '商品'],
  '飲食店・宿泊業': [
    '飲食',
    'グルメ',
    'レストラン',
    '宿泊',
    'ホテル',
    'メニュー',
  ],
  サービス業: ['サービス', '店舗'],
  '医療・福祉': ['医療', '福祉', '介護', 'ヘルスケア'],
  '教育・学習支援業': ['教育', 'スクール', '学習'],
  不動産業: ['不動産', '住宅'],
  建設業: ['建設', '住宅'],
  '運輸・情報通信業': ['物流', '運輸'],
}

/** リリース種別 → タイトルに出てくる語 */
const TYPE_WORDS = {
  商品サービス: ['新商品', '新製品', '新サービス', 'リリース'],
  イベント: ['イベント', '開催', 'セミナー'],
  キャンペーン: ['キャンペーン', 'コラボ'],
  経営情報: ['資金調達', '業務提携', '周年', '移転'],
  調査レポート: ['調査', 'レポート', 'ランキング'],
  人物: ['人事', '入社', '採用', '就任'],
}

const has = (title, words) => words.some((w) => title.includes(w))

/**
 * @param {object} ctx
 * @param {string} ctx.branch     BRANCH のキー
 * @param {string} [ctx.industry] 業種名
 * @param {string} [ctx.type]     リリース種別
 * @param {number} [ctx.limit]
 */
export function pick({ branch, industry, type, limit = 3 } = {}) {
  if (!ARTICLES.length) return []
  const rule = BRANCH[branch] || {}
  const iw = INDUSTRY_WORDS[industry] || []
  const tw = TYPE_WORDS[type] || []

  // must を持つ分岐では、その語を含まない記事は候補から外す
  //（業種一致だけで拾ってしまうと、分岐の意図が消える）
  const pool = rule.must?.length
    ? ARTICLES.filter((a) => has(a.title, rule.must))
    : ARTICLES

  const scored = pool.map((a) => {
    let score = 0
    const why = []

    if (rule.purposes?.some((p) => a.purposes.includes(p))) {
      score += 3
      why.push('目的が一致')
    }
    if (rule.levels?.some((l) => a.levels.includes(l))) {
      score += 3
      why.push('レベルが一致')
    }
    if (rule.want?.length && has(a.title, rule.want)) {
      score += 2
    }
    if (rule.must?.length) {
      score += 4
      why.push('この状況に対応')
    }

    // 業種一致は効くが、強すぎると分岐の意図を潰すので控えめにする
    if (iw.length && has(a.title, iw)) {
      score += 3
      why.push(`${industry}向け`)
    }
    if (tw.length && has(a.title, tw)) {
      score += 3
      why.push(`${type}のリリース`)
    }

    // テンプレート記事は「書き方＋配信事例N選」がセットになっている
    if (a.title.includes('テンプレート')) {
      score += 2
      why.push('書き方と配信事例つき')
    } else if (/事例\d*選|配信事例/.test(a.title)) {
      score += 1
      why.push('配信事例つき')
    }

    return { ...a, score, why }
  })

  return scored
    .filter((a) => a.score >= 5) // 分類が当たっただけの記事は出さない
    .filter((a) => !/用語集|とは？$/.test(a.title)) // 辞書的な記事は提案にならない
    .sort(
      (a, b) => b.score - a.score || (b.date || '').localeCompare(a.date || ''),
    )
    .slice(0, limit)
    .map((a) => ({
      title: a.title,
      url: SITE + a.uri,
      why: [...new Set(a.why)].join('・'),
      excerpt: a.excerpt?.slice(0, 90),
    }))
}
