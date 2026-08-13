import 'server-only'

import { env } from '@/shared/env'

import type {
  Interest,
  Objection,
  Reaction,
  Reason,
} from '../domain/conversation'
import type { Classifier, Narrator } from '../domain/language'

const ENDPOINT = 'https://api.openai.com/v1/chat/completions'

/**
 * 分類は軽いモデルで足りる。言い換えも下書きがあるので賢さは要らない。
 * gpt-4o-mini と gpt-3.5-turbo で出力を比べても数値の欠落は無かった。
 */
const MODEL = 'gpt-4o-mini'

async function chat(
  system: string,
  user: string,
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<string> {
  const apiKey = env().OPENAI_API_KEY
  if (!apiKey) return ''

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 700,
      }),
    })
    if (!res.ok) {
      console.error(
        '[pr-compass] OpenAI',
        res.status,
        (await res.text()).slice(0, 200),
      )
      return ''
    }
    const data = await res.json()
    return String(data.choices?.[0]?.message?.content ?? '').trim()
  } catch (e) {
    console.error('[pr-compass] OpenAI', e)
    return ''
  }
}

/** 自由入力を1語の id に落とす。迷ったら既定値へ倒す */
function pick<T extends string>(
  raw: string,
  ids: readonly T[],
  fallback: T,
): T {
  const lower = raw.toLowerCase()
  return ids.find((id) => lower.includes(id)) ?? fallback
}

const classifyPrompt = (options: Record<string, string>) =>
  `ユーザーの発言を、次のどれか1つに割り当てる。

${Object.entries(options)
  .map(([id, label]) => `${id}: ${label}`)
  .join('\n')}

判断がつかない場合は最後の項目。
出力は id をそのまま1語だけ。説明も記号も付けない。`

export function openAiClassifier(): Classifier {
  return {
    async reason(text) {
      if (!text) return 'none'
      const raw = await chat(
        classifyPrompt({
          no_topic: '出すネタが見つからない・何を書けばいいか分からない',
          no_time: '時間が取れない・忙しい・手が回らない',
          no_effect: '出しても反応が無かった・効果を感じられなかった',
          handover: '担当が変わった・引き継いでいない・分からない',
          none: '特に理由はない・なんとなく',
        }),
        text,
        { maxTokens: 6, temperature: 0 },
      )
      return pick<Reason>(
        raw,
        ['no_topic', 'no_time', 'no_effect', 'handover', 'none'],
        'none',
      )
    },

    async interest(text) {
      if (!text) return 'topic'
      const raw = await chat(
        classifyPrompt({
          pv: 'もっと多くの人に見てもらいたい・読まれたい',
          media: 'メディアに取り上げられたい・取材されたい',
          story: '会社や商品の背景・想いを知ってほしい',
          topic: '何を配信すればいいか分からない・ネタから相談したい',
        }),
        text,
        { maxTokens: 6, temperature: 0 },
      )
      return pick<Interest>(raw, ['pv', 'media', 'story', 'topic'], 'topic')
    },

    async reaction(text) {
      if (!text) return 'write'
      const raw = await chat(
        classifyPrompt({
          human: '担当者・人と話したい',
          boss: '社内で通せるか不安・上司に説明が要る',
          doubt: '効果が出るか半信半疑・本当に意味があるのか',
          weak: 'ピンとこない・しっくりこない・別の案が見たい',
          more: '書き方をもっと知りたい・事例を見たい',
          write: 'やってみる・書いてみる・進める',
        }),
        text,
        { maxTokens: 6, temperature: 0 },
      )
      return pick<Reaction>(
        raw,
        ['human', 'boss', 'doubt', 'weak', 'more', 'write'],
        'write',
      )
    },

    async objection(text) {
      if (!text) return 'content'
      const raw = await chat(
        classifyPrompt({
          audience: '届けたい相手が違う',
          content: '伝えたい内容が違う',
          tried: '前に似たことを試して駄目だった',
          effort: '手間がかかりすぎる',
        }),
        text,
        { maxTokens: 6, temperature: 0 },
      )
      return pick<Objection>(
        raw,
        ['audience', 'content', 'tried', 'effort'],
        'content',
      )
    },
  }
}

const SPEAK_SYSTEM = `あなたはPR TIMESの広報伴走エージェントの「言い換え」部品です。

相手は広報・マーケティングの知見がない担当者。社長が兼任していることも多い。忙しい。

仕事は、渡された下書き(draft)を、その会社に向いた自然な話し言葉に書き直すことです。

- 数値は下書きのものを1つも変えず、1つも落とさない
- facts に無い事実を作らない（機能名・実績・数字を勝手に足さない）
- 一般論・励まし・精神論を書かない（「継続が大切です」など禁止）
- 他社名を出さない。順位づけや比較をしない
- マーケ用語を使わない（KPI・リーチ・ターゲット等）
- 断定しない。「差があります」と書き、「上がります」と書かない
- 見出し・箇条書きの記号を増やさない。下書きの構成をそのまま保つ
- 最後の問いかけは必ず残す

出力は書き直した本文のみ。前置きも囲みも付けない。`

const MEMO_SYSTEM = `あなたは広報担当者との面談メモを書く担当です。

2つの観点を、自然文で1つにまとめて書きます。

① わかった事実（業種・配信状況・止まった経緯・やりたいこと）
② やりとりから読み取れる傾向（返答の長さ、決め方、広報への姿勢、何に反応するか）

- 箇条書き・見出し・番号は使わない
- 「ターン」「フェーズ」などの内部語は書かない
- 前回のメモを引き継ぎ、新しく分かったことを足して全文を書き直す
- 第三者が読んで、この企業のことがよくわかる手記のように書く
- まだ相手が何も話していないときは、空文字だけを返す

出力はメモ本文のみ。`

export function openAiNarrator(): Narrator {
  return {
    async speak({ facts, draft, history }) {
      const out = await chat(
        SPEAK_SYSTEM,
        JSON.stringify(
          {
            facts,
            draft,
            直前のやりとり: history.map((m) => `${m.role}: ${m.content}`),
          },
          null,
          2,
        ),
        { maxTokens: 900, temperature: 0.4 },
      )
      // 言い換えに失敗しても会話は止めない。下書きがそのまま出るだけ
      return out || draft
    },

    async memo({ facts, history, previous }) {
      if (!history.some((m) => m.role === 'user')) return ''
      const out = await chat(
        MEMO_SYSTEM,
        JSON.stringify(
          {
            これまでのメモ: previous,
            今回わかった事実: facts,
            やりとり: history.map((m) => `${m.role}: ${m.content}`),
          },
          null,
          2,
        ),
        { maxTokens: 500, temperature: 0.4 },
      )
      return out || previous
    },
  }
}
