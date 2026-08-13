/**
 * PR TIMES MAGAZINE の記事索引を収集する。
 *
 * マガジンには purpose（目的別）/ level（レベル別）という既製の分類がある。
 * これがそのまま対話の分岐に使えるので、分類を自作せずこれを取り込む。
 *
 * 出力: magazine.json  { articles: {uri: {...}}, taxonomy: {...} }
 */
import fs from 'node:fs/promises'

const BASE = 'https://prtimes.com/magazine'
const UA = 'Mozilla/5.0 (compatible; prtimes-hackathon-prototype)'
const WAIT = 700 // 相手のサーバに負荷をかけない

const CATEGORIES = [
  ['pr-know-how', 'PR TIMESノウハウ'],
  ['press-release', 'プレスリリース'],
  ['pr', '広報・PR'],
  ['marketing', 'マーケティング'],
  ['media', 'メディア'],
  ['public-relations-pr-interview', '広報PRインタビュー'],
  ['manager-pr-interview', '経営者インタビュー'],
  ['event-report', 'イベントレポート'],
  ['media-opinion', 'メディア関係者・有識者の見解'],
  ['pr-person', '広報担当者'],
  ['personnel-affairs', '人事'],
]
const PURPOSES = [
  ['how-_to_pr', '知っておきたい広報PRの基礎'],
  ['level_up', '広報PR活動をブラッシュアップ'],
  ['information_acquisition', '参考にしたい他社の成功事例'],
  ['quality', 'ワンランク上の広報PRを目指したい'],
  ['amount_of_nformation', '広報PRの情報発信を充実させたい'],
]
const LEVELS = [
  ['introduction', 'イントロダクション'],
  ['beginner', 'ビギナー'],
  ['middle', 'ミドル'],
  ['expert', 'エキスパート'],
  ['management', 'マネジメント'],
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const strip = (s) =>
  String(s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

async function page(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  const html = await res.text()
  const m = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s,
  )
  if (!m) throw new Error(`no __NEXT_DATA__ ${url}`)
  return JSON.parse(m[1]).props.pageProps
}

/** 一覧を最終ページまで辿る */
async function crawl(base, label) {
  const out = []
  let total = 1
  for (let p = 1; p <= total; p++) {
    const url = p === 1 ? `${base}/` : `${base}/page/${p}/`
    try {
      const pp = await page(url)
      total = Math.min(pp.totalPages || 1, 40) // 暴走防止
      for (const post of pp.posts || []) {
        out.push({
          uri: post.uri,
          title: strip(post.title),
          excerpt: strip(post.excerpt).slice(0, 300),
          date: post.date,
          categories: (post.categories?.nodes || []).map((c) => c.name),
        })
      }
      process.stdout.write(
        `\r  ${label}: ${p}/${total}ページ (${out.length}件)   `,
      )
    } catch (e) {
      console.log(`\n  ! ${label} p${p}: ${e.message}`)
      break
    }
    await sleep(WAIT)
  }
  console.log('')
  return out
}

const articles = new Map()
const add = (list, field, value) => {
  for (const a of list) {
    const cur = articles.get(a.uri) || { ...a, purposes: [], levels: [] }
    if (field && !cur[field].includes(value)) cur[field].push(value)
    articles.set(a.uri, cur)
  }
}

console.log('■ カテゴリ')
for (const [slug, name] of CATEGORIES)
  add(await crawl(`${BASE}/category/${slug}`, name), null)

console.log('\n■ 目的別（対話の分岐に使う）')
for (const [slug, name] of PURPOSES)
  add(await crawl(`${BASE}/purpose/${slug}`, name), 'purposes', name)

console.log('\n■ レベル別（対話の分岐に使う）')
for (const [slug, name] of LEVELS)
  add(await crawl(`${BASE}/level/${slug}`, name), 'levels', name)

const list = [...articles.values()]
await fs.writeFile(
  'magazine.json',
  JSON.stringify(
    {
      fetched_at: new Date().toISOString(),
      taxonomy: {
        purposes: PURPOSES.map(([s, n]) => ({ slug: s, name: n })),
        levels: LEVELS.map(([s, n]) => ({ slug: s, name: n })),
      },
      articles: list,
    },
    null,
    1,
  ),
)

console.log(`\n✔ 記事 ${list.length}件 → magazine.json`)
console.log(`  目的タグあり: ${list.filter((a) => a.purposes.length).length}件`)
console.log(`  レベルタグあり: ${list.filter((a) => a.levels.length).length}件`)
