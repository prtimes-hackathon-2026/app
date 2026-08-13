import 'server-only'

import { Agent } from '@openai/agents'

import { narratorModel, openaiRunner } from '@/external/openai'

import type { Draft, NarratorPort } from '../domain/llm'

/**
 * 下書きの言い換え。プロトタイプ (voice-agent/src/narrate.js) の移植。
 *
 * LLM に渡すのは日本語ラベルの事実辞書 (facts) と下書き (draft) だけで、
 * 生の指標名は渡さない。`eval_point` のような名前を見せると意味を推測で埋められ、
 * 数値の解釈がその場で作り変えられてしまう。
 */

/**
 * プロトタイプのシステムプロンプトをそのまま踏襲する。
 * 特に最後の「断定しない」は相関を因果として語らないための制約なので外さない
 * (当たり率カーブは相関であって因果ではない。設計 §5 の統計上の限界)。
 */
const instructions = `あなたはPR TIMESの広報伴走エージェントの「言い換え」部品です。

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

/** JSON だけを返すよう指示していても囲みが付いてくることがあるので剥がす */
function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const stripped = text.replace(/^```(?:json)?|```$/gm, '').trim()
    const parsed: unknown = JSON.parse(stripped)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return null
    }
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * draft のキー集合でしか上書きしない (ホワイトリスト)。
 * LLM が余計なキーを足しても、キーを落としても、出力の形状は draft のまま保たれる。
 */
function overwriteByDraftKeys(
  draft: Draft,
  parsed: Record<string, unknown>,
): Draft {
  const out: Record<string, string> = { ...draft }
  for (const key of Object.keys(draft)) {
    const value = parsed[key]
    if (typeof value === 'string' && value.trim()) out[key] = value.trim()
  }
  return out
}

export function openaiNarrator(): NarratorPort {
  return {
    async narrate({ facts, draft }) {
      try {
        // Runner も Agent も呼び出し時に取る。env() の遅延評価を壊さないため
        const runner = openaiRunner()
        if (!runner) return null

        const { model, modelSettings } = narratorModel()
        const agent = new Agent({
          name: 'PR TIMES 広報伴走エージェント / 言い換え',
          instructions,
          model,
          modelSettings,
        })

        const result = await runner.run(
          agent,
          JSON.stringify({ facts, draft }, null, 2),
        )
        const output = result.finalOutput
        if (!output) return null

        const parsed = parseJsonObject(output)
        if (!parsed) return null

        return overwriteByDraftKeys(draft, parsed)
      } catch (error) {
        // 落ちても会話は続けたいので握り潰す。呼び出し側がテンプレのまま進む
        console.error('[pr-agent] narrate に失敗しました', error)
        return null
      }
    },
  }
}
