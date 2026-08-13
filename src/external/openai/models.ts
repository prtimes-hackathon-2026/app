import 'server-only'

import {
  gpt5ReasoningSettingsRequired,
  type ModelSettings,
} from '@openai/agents'

import { env } from '@/shared/env'

/**
 * LLM に投げる 3 つの仕事のモデル設定。
 *
 * ここはドメインを知らない。「どの仕事にどのモデルを当てるか」という
 * 接続側の都合だけを持ち、プロンプトや戻り値の解釈は feature 側に置く。
 *
 * 温度は指定しない。プロトタイプ (voice-agent) は gpt-4o-mini に temperature を
 * 渡していたが、gpt-5 系ではぶれ幅は reasoning.effort 側で決まる。
 */

/**
 * reasoning.effort の型。`ModelSettingsReasoningEffort` は
 * @openai/agents のルートから export されていないので ModelSettings から引く。
 */
type ReasoningEffort = NonNullable<ModelSettings['reasoning']>['effort']

export type ModelChoice = {
  readonly model: string
  readonly modelSettings: ModelSettings
}

/**
 * reasoning を付けるかは SDK の判定関数に委ねる。
 * 環境変数で gpt-5 系以外に差し替えたときに reasoning を送ると弾かれるため、
 * モデル名の判定をこちらで書き写さない。
 */
function choose(model: string, effort: ReasoningEffort): ModelChoice {
  return {
    model,
    modelSettings: gpt5ReasoningSettingsRequired(model)
      ? { reasoning: { effort } }
      : {},
  }
}

/** 文章化。下書きの言い換えなので考えさせすぎない */
export function narratorModel(): ModelChoice {
  return choose(env().OPENAI_NARRATOR_MODEL, 'low')
}

/** 分類。4 択に落とすだけなので推論は要らない */
export function classifierModel(): ModelChoice {
  return choose(env().OPENAI_CLASSIFIER_MODEL, 'none')
}

/** 3 層推定。既定を文章化と同じにしているのは、同じ質の日本語が要るため */
export function profilerModel(): ModelChoice {
  const config = env()
  return choose(
    config.OPENAI_PROFILER_MODEL ?? config.OPENAI_NARRATOR_MODEL,
    'low',
  )
}
