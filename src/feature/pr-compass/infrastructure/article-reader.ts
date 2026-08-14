import 'server-only'

import { env } from '@/shared/env'

/**
 * 選んだ記事を1本だけ実際に読んで、要点を取り出す。
 *
 * ここまでは記事のリンクを並べるだけで、中身は誰も読んでいなかった。
 * 「参考になります」とは言えても「何が書いてあるか」が言えない状態だったので、
 * 出す記事が決まったあとに本文を取りにいく。
 *
 * ベクトル検索は使っていない。どの記事を出すかは既に分類で決まっているので、
 * 探す必要がなく、読むだけでよい。どの記事から引いたかも確定する。
 */

const UA = 'Mozilla/5.0 (compatible; prtimes-hackathon-prototype)'
const TIMEOUT_MS = 6000
const OPENAI_TIMEOUT_MS = 8000
const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions'
const MODEL = 'gpt-4o-mini'

/** 抽出済みの要点。プロセス内だけの短命なキャッシュで十分 */
const cache = new Map<string, string[]>()
const CACHE_MAX = 40

const strip = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()

/** 記事ページから本文を取り出す。取れなければ空 */
async function fetchBody(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: controller.signal,
    })
    if (!res.ok) return ''
    const html = await res.text()
    const m = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s)
    if (!m?.[1]) return ''
    const pageProps = JSON.parse(m[1]).props?.pageProps as
      { content?: string } | undefined
    return strip(pageProps?.content ?? '')
  } catch {
    // 記事が読めなくても会話は止めない。リンクだけ出る状態に戻るだけ
    return ''
  } finally {
    clearTimeout(timer)
  }
}

const SYSTEM = `あなたは記事から要点を抜き出す部品です。

渡された記事本文から、広報担当者がこれから動くために必要な要点だけを取り出します。

- 2つまで。1つにつき1文、40字程度
- 記事に書かれていないことは書かない
- 「〜が大切です」のような一般論は取らない。具体的な手順や条件だけを取る
- 主語は省いてよい。「まず〜する」「〜を確認する」の形で書く

出力は要点だけを改行で区切って返す。番号も記号も前置きも付けない。
取れる要点が無ければ空文字を返す。`

/**
 * 記事を1本読んで要点を返す。
 * 記事が読めない・要点が取れない場合は空配列を返し、呼び出し側は
 * これまでどおりリンクだけを出す。
 */
export async function readKeyPoints(
  url: string,
  context: string,
): Promise<string[]> {
  // 同じ記事でも相談内容によって必要な箇所は変わるため、文脈もキーに含める。
  const cacheKey = `${url}\n${context.trim().slice(0, 800)}`
  const hit = cache.get(cacheKey)
  if (hit !== undefined) return hit

  const apiKey = env().OPENAI_API_KEY
  if (!apiKey) return []

  const body = await fetchBody(url)
  if (body.length < 200) return []

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS)
  try {
    const res = await fetch(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 160,
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: JSON.stringify({
              いまの状況: context,
              記事本文: body.slice(0, 6000),
            }),
          },
        ],
      }),
    })
    if (!res.ok) return []

    const data = await res.json()
    const points = String(data.choices?.[0]?.message?.content ?? '')
      .split('\n')
      .map((s) => s.replace(/^[-・\d.\s]+/, '').trim())
      .filter((s) => s.length > 4)
      .slice(0, 2)

    if (cache.size >= CACHE_MAX) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) cache.delete(oldest)
    }
    cache.set(cacheKey, points)
    return points
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}
