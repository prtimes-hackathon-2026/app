import 'server-only'

import { Agent } from '@openai/agents'

import { classifierModel, openaiRunner } from '@/external/openai'

import { interestIds } from '../domain/interest'
import type { ClassifierPort } from '../domain/llm'

import { interestLabels } from './interest-labels'

/**
 * 自由発話を 4 分類に割り当てる。プロトタイプ (voice-agent/src/voice.js) の移植。
 *
 * 「それはつまり○○ですね」と言い直させず、黙って分類する。
 * 言い換え確認は相手にとって情報量がゼロで、往復だけが増えるため (設計 §2)。
 */

const instructions = `ユーザーの発話を、次の4つのどれか1つに割り当てる。

${interestIds.map((id) => `${id}: ${interestLabels[id]}`).join('\n')}

判断がつかない場合は topic。
出力は id をそのまま1語だけ。説明も記号も付けない。`

/** 長文を丸ごと渡しても分類はぶれるだけなので頭を切り出す (プロトタイプと同じ) */
const maxInputLength = 500

export function openaiClassifier(): ClassifierPort {
  return {
    async classify(text) {
      const input = text.trim()
      if (!input) return null

      try {
        const runner = openaiRunner()
        if (!runner) return null

        const { model, modelSettings } = classifierModel()
        const agent = new Agent({
          name: 'PR TIMES 広報伴走エージェント / 分類',
          instructions,
          model,
          modelSettings,
        })

        const result = await runner.run(agent, input.slice(0, maxInputLength))
        const output = result.finalOutput?.trim()
        if (!output) return null

        // 1 語だけを指示しても前後に語が付くことがあるので、含まれる id を拾う
        return interestIds.find((id) => output.includes(id)) ?? null
      } catch (error) {
        // 分類できないこと自体は想定内。topic に倒すのは呼び出し側の仕事
        console.error('[pr-agent] classify に失敗しました', error)
        return null
      }
    },
  }
}
