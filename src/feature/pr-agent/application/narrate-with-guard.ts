import type { Draft, FactSheet, NarratorPort } from '../domain/llm'
import { inspectNarrative } from '../domain/narrative-guard'
import type { Narrative } from '../domain/turn'

/**
 * 文章化のただ 1 つの入口。
 *
 * LLM が不変条件を破ったら 1 回だけ書き直させ、それでも駄目ならテンプレの
 * 下書きをそのまま出す。キーが無い / JSON が壊れている / ポートが落ちた場合も
 * 同じ結末になる。「LLM が無くても会話が成立する」という性質をここで担保する。
 */

export type NarrateWithGuard = (input: {
  readonly facts: FactSheet
  readonly draft: Draft
  /** そのターンの問い。終端ターンでは渡さない */
  readonly questionText?: string | null
}) => Promise<Narrative>

/**
 * ポートの戻り値を draft のキー集合に閉じ込める。
 * 余計なキーを返されても提示物の形が壊れず、欠けたキーは下書きのまま残る。
 */
function merge(draft: Draft, output: Draft): Draft {
  const merged: Record<string, string> = { ...draft }
  for (const key of Object.keys(draft)) {
    const value = output[key]
    if (typeof value === 'string' && value.trim()) merged[key] = value.trim()
  }
  return merged
}

/** ポートの契約は「失敗は null」だが、実装の事故で例外が漏れても会話は止めない */
async function tryNarrate(
  narrator: NarratorPort,
  facts: FactSheet,
  draft: Draft,
): Promise<Draft | null> {
  try {
    const output = await narrator.narrate({ facts, draft })
    return output ? merge(draft, output) : null
  } catch {
    return null
  }
}

export function narrateWithGuard(narrator: NarratorPort): NarrateWithGuard {
  return async ({ facts, draft, questionText = null }) => {
    // 1 回目 + 再生成の 1 回まで。ここを可変にすると 1 ターンの待ち時間が読めなくなる
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const output = await tryNarrate(narrator, facts, draft)
      // ポートが落ちているときは書き直させても同じなので、すぐテンプレに落とす
      if (!output) break

      const violations = inspectNarrative({
        facts,
        draft,
        output,
        questionText,
      })
      if (violations.length === 0) return { text: output, source: 'llm' }
    }

    return { text: draft, source: 'template' }
  }
}
