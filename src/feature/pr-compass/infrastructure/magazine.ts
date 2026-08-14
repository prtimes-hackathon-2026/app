import 'server-only'

import fs from 'node:fs'
import path from 'node:path'

import type { Interest, Reason } from '../domain/conversation'

/**
 * PR TIMES MAGAZINE の記事から、いまの状況に合うものを選ぶ。
 *
 * 埋め込み（ベクトル検索）は使っていない。理由は3つ:
 *  ・マガジン側に purpose（目的別）/ level（レベル別）という既製の分類があり、
 *    会話の分岐にそのまま対応する
 *  ・「なぜこの記事を出したか」を画面に出せる必要がある
 *  ・1,188件なら全件スコアリングしても一瞬で終わる
 *
 * 収集は scripts/scrape-magazine.mjs（RSS は最新10件しか返さないため
 * 記事一覧ページの __NEXT_DATA__ から取っている）。
 */

const SITE = 'https://prtimes.com/magazine'

type Article = {
  uri: string
  title: string
  excerpt?: string
  date?: string
  categories: string[]
  purposes: string[]
  levels: string[]
}

export type Suggestion = {
  title: string
  url: string
  /** なぜこの記事を出したか。根拠を示せないものは出さない */
  why: string
}

function load(): Article[] {
  try {
    const file = path.join(process.cwd(), 'magazine.json')
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      articles?: Article[]
    }
    return raw.articles ?? []
  } catch {
    // 未収集でも動く。記事が出ないだけ
    return []
  }
}

let cached: Article[] | null = null
const articles = () => (cached ??= load())

export const magazineCount = () => articles().length

type Rule = {
  purposes?: string[]
  levels?: string[]
  /** タイトルに必ず含まれていてほしい語。分岐の意図を守るために使う */
  must?: string[]
  want?: string[]
  /** 語は当たるが状況には合わない記事を落とす */
  deny?: string[]
  /** これに当たるものを最優先で出す */
  prefer?: string[]
}

/** 止まった理由 → どんな記事を出すか */
const BY_REASON: Record<Reason, Rule> = {
  no_topic: {
    purposes: ['広報PRの情報発信を充実させたい'],
    want: ['ネタ', 'テンプレート', '書き方', '事例'],
  },
  no_time: {
    levels: ['ビギナー'],
    want: ['テンプレート', '効率', 'STEP', '時短'],
  },
  no_effect: {
    purposes: ['広報PR活動をブラッシュアップ'],
    must: ['効果', '分析', '改善', '読まれ', 'データ'],
  },
  handover: {
    levels: ['イントロダクション'],
    must: ['新任', '異動', '退職', '引き継', '担当者になったら', 'アカウント'],
    // 「異動」「退職」は挨拶メールの記事にも当たるが、引き継ぎの助けにはならない
    deny: ['挨拶', 'マナー', '例文', '送別', '菓子'],
    prefer: ['新任', '引き継', '担当者になったら'],
  },
  none: { levels: ['イントロダクション'] },
}

/** やりたいこと → どんな記事を出すか */
const BY_INTEREST: Record<Interest, Rule> = {
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
const INDUSTRY_WORDS: Record<string, string[]> = {
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
}

const has = (title: string, words: readonly string[]) =>
  words.some((w) => title.includes(w))

function select(rule: Rule, industry: string, limit: number): Suggestion[] {
  const all = articles()
  if (!all.length) return []

  const iw = INDUSTRY_WORDS[industry] ?? []

  // must がある分岐では、その語を含まない記事を候補から外す。
  // 業種一致だけで拾ってしまうと、分岐の意図が消える
  const pool = (
    rule.must?.length ? all.filter((a) => has(a.title, rule.must ?? [])) : all
  ).filter((a) => !rule.deny?.length || !has(a.title, rule.deny))

  return pool
    .map((a) => {
      let score = 0
      const why: string[] = []

      if (rule.purposes?.some((p) => a.purposes.includes(p))) {
        score += 3
        why.push('目的が一致')
      }
      if (rule.levels?.some((l) => a.levels.includes(l))) {
        score += 3
        why.push('いまの状況に合う')
      }
      if (rule.want?.length && has(a.title, rule.want)) score += 2
      if (rule.must?.length) {
        score += 4
        why.push('この状況に対応')
      }
      if (rule.prefer?.length && has(a.title, rule.prefer)) score += 5
      // 業種一致は効くが、強すぎると分岐の意図を潰すので控えめにする
      if (iw.length && has(a.title, iw)) {
        score += 3
        why.push(`${industry}向け`)
      }
      // テンプレート記事は「書き方＋配信事例N選」がセットになっている
      if (a.title.includes('テンプレート')) {
        score += 2
        why.push('書き方と配信事例つき')
      } else if (/事例\d*選|配信事例/.test(a.title)) {
        score += 1
        why.push('配信事例つき')
      }

      return { article: a, score, why }
    })
    .filter((x) => x.score >= 5)
    .filter((x) => !/用語集|とは？$/.test(x.article.title))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.article.date ?? '').localeCompare(a.article.date ?? ''),
    )
    .slice(0, limit)
    .map((x) => ({
      title: x.article.title,
      url: SITE + x.article.uri,
      why: [...new Set(x.why)].join('・'),
    }))
}

export function articlesForReason(
  reason: Reason,
  industry: string,
  limit = 2,
): Suggestion[] {
  return select(BY_REASON[reason], industry, limit)
}

export function articlesForInterest(
  interest: Interest,
  industry: string,
  limit = 3,
): Suggestion[] {
  return select(BY_INTEREST[interest], industry, limit)
}
