import 'dotenv/config'

const KEY = (process.env.OPENAI_API_KEY || '').trim()
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

const SYSTEM = `あなたはPR TIMESの広報伴走エージェントの「言い換え」部品です。

相手は広報・マーケティングの知見がない担当者。社長が兼任していることも多い。忙しい。

仕事は、渡された下書き(draft)を、**その会社の商品に即した言葉に書き直す**ことです。

facts には「御社が実際に出したリリース」「御社の事業内容」が入っています。
下書きが一般論に見える箇所は、この2つを使って、その会社の商品の話として書き直してください。
たとえば「調査レポートの形にする」だけで終わらせず、
その会社の商品なら具体的にどんな調査になるのかを一言添えます。

- **数値は下書きのものを1つも変えず、1つも落とさない**
- facts に無い事実を作らない（商品名・実績・機能を勝手に足さない）
- facts に書かれた日本語ラベルが指標の意味の唯一の正解。自分で推測しない
- 一般論・励まし・精神論を書かない（「継続が大切です」など禁止）
- 他社名を出さない。比較や順位づけをしない
- マーケ用語を使わない（KPI・ターゲット・リーチ・パーセンタイル等）
- 断定しない。「差があります」と書き、「上がります」と書かない

出力はJSONのみ。draft と同じキーを持たせること。各1〜3文、日本語。`

/** AI SDK は言い換えにだけ使う。数値はすべてSQL側で算出済み。 */
export async function narrate({ facts, draft }) {
  if (!KEY) return { text: draft, source: 'テンプレート（OpenAIキー未設定）' }

  try {
    const { generateText } = await import('ai')
    const { createOpenAI } = await import('@ai-sdk/openai')
    const openai = createOpenAI({ apiKey: KEY })

    const { text } = await generateText({
      model: openai(MODEL),
      system: SYSTEM,
      prompt: JSON.stringify({ facts, draft }, null, 2),
      temperature: 0.3,
    })

    const json = JSON.parse(text.replace(/^```(?:json)?|```$/gm, '').trim())
    const out = { ...draft }
    for (const k of Object.keys(draft)) {
      if (typeof json[k] === 'string' && json[k].trim()) out[k] = json[k].trim()
    }
    return { text: out, source: `AI SDK / ${MODEL}` }
  } catch (e) {
    console.error('[narrate]', e.message)
    return { text: draft, source: `テンプレート（${e.name}）` }
  }
}
