import type { Draft, FactSheet } from './llm'

/**
 * LLM が返した文章が、設計で決めた不変条件を破っていないかを機械的に見る。
 *
 * LLM を呼ばない純関数なので CI に載る。違反したら 1 回だけ再生成し、
 * それでも駄目ならテンプレの draft に落とす、という判断は呼び出し側が行う。
 * そのため「駄目でした」ではなく「どの規則にどう違反したか」を配列で返す。
 *
 * blocks が 1 つ以上あること・3 ターンを超えないことは型で閉じている
 * (turn.ts / conversation.ts) のでここでは扱わない。ここは文章だけを見る。
 */

export type NarrativeRule =
  | 'fabricated_number'
  | 'dropped_number'
  | 'causal_claim'
  | 'marketing_jargon'
  | 'platitude'
  | 'multiple_questions'

export type NarrativeViolation = {
  readonly rule: NarrativeRule
  /** 違反した draft のキー。質問文は 'question'、ターン全体の規則は 'turn' */
  readonly key: string
  /** 違反の当該部分。数値トークンか禁止語 */
  readonly found: string
  readonly message: string
}

export type NarrativeGuardInput = {
  readonly facts: FactSheet
  readonly draft: Draft
  /** LLM が返した文章。draft と同じキー集合である前提 */
  readonly output: Draft
  /** そのターンの問い。終端ターンでは null */
  readonly questionText?: string | null
}

/**
 * 相関を因果として語る表現。
 *
 * 「上がりました」「上がっています」のような観測の記述は含めない。
 * 再開前後の当たり率は実測された差であって、これからの因果の約束ではないため。
 * 「必ず」も入れない。「必ずしも上がるわけではありません」という
 * 断定を否定する文まで弾いてしまう。
 *
 * 逆に「上がるとは限りません」のような否定形は素通しにせず弾いてしまうが、
 * そのときはテンプレの下書きに落ちるだけで嘘は出ない。安全側に倒しておく。
 */
export const causalPhrases = [
  '上がります',
  '上がる',
  '上がっていきます',
  '増えます',
  '増える',
  '増えていきます',
  '伸びます',
  '伸びる',
  '伸びていきます',
  '向上します',
  '改善します',
  '改善されます',
  '確実に',
  '保証',
] as const

/** 相手は広報・マーケの知見がない担当者。業界語で説明しない */
export const marketingTerms = [
  'KPI',
  'ターゲット',
  'リーチ',
  'パーセンタイル',
  'エンゲージメント',
  'コンバージョン',
  'インプレッション',
  'ブランディング',
  'ファネル',
  'ペルソナ',
  'セグメント',
  'PDCA',
  'ROI',
  'CTR',
  'CVR',
] as const

/** 一般論・励まし。相手が知らなかった事実だけを返すという原則を壊す */
export const platitudePhrases = [
  '継続が大切',
  '継続は力',
  'コツコツ',
  '地道に',
  '長期的な視点',
  '長い目で',
  '諦めずに',
  '頑張',
  '一歩ずつ',
  '焦らず',
  'きっと',
  '応援しています',
  '大切です',
  '重要です',
  '心がけ',
] as const

/**
 * 数値トークンを取り出す。
 *
 * 桁区切りは 3 桁ごとのときだけ 1 つの数値とみなす。「3,5」のような
 * 桁区切りでないカンマまで繋げると、別々の数値が 1 つに化けるため。
 */
const numberPattern = /\d+(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g

/** 全角数字は半角に寄せる。表記だけ変えて数値を作り替えられないようにする */
function toHalfWidth(text: string): string {
  return text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  )
}

export function extractNumbers(text: string): readonly string[] {
  const matched = toHalfWidth(text).match(numberPattern) ?? []
  return matched.map((token) => token.replace(/,/g, ''))
}

/**
 * 出力に置いてよい数値の集合。
 *
 * facts は値だけでなくキーも入れる。「3年経過時点の当たり率」のように
 * 指標の定義そのものがキーになっており、そこにある数値は本文で使ってよい。
 */
function allowedNumbers(facts: FactSheet, draft: Draft): ReadonlySet<string> {
  const allowed = new Set<string>()
  for (const [key, value] of Object.entries(facts)) {
    for (const n of extractNumbers(key)) allowed.add(n)
    for (const n of extractNumbers(value)) allowed.add(n)
  }
  for (const value of Object.values(draft)) {
    for (const n of extractNumbers(value)) allowed.add(n)
  }
  return allowed
}

function findPhrase(
  text: string,
  phrases: readonly string[],
): string | undefined {
  return phrases.find((phrase) => text.includes(phrase))
}

function countQuestionMarks(text: string): number {
  return (text.match(/[？?]/g) ?? []).length
}

/**
 * プロトタイプ (voice-agent/modeltest.mjs) は
 * `MUST = { position: ['1','17'], … }` と、残っていてほしい数値を手書きしていた。
 * ここでは draft から数値トークンを自動抽出し、
 * 「落とさない」(dropped) と「作らない」(fabricated) の両方を照合する。
 */
export function inspectNarrative(
  input: NarrativeGuardInput,
): readonly NarrativeViolation[] {
  const { facts, draft, output, questionText = null } = input
  const violations: NarrativeViolation[] = []
  const allowed = allowedNumbers(facts, draft)

  for (const [key, text] of Object.entries(output)) {
    for (const number of extractNumbers(text)) {
      if (allowed.has(number)) continue
      violations.push({
        rule: 'fabricated_number',
        key,
        found: number,
        message: `facts と draft のどこにも無い数値「${number}」が現れています`,
      })
    }

    const before = extractNumbers(draft[key] ?? '')
    const after = new Set(extractNumbers(text))
    for (const number of before) {
      if (after.has(number)) continue
      violations.push({
        rule: 'dropped_number',
        key,
        found: number,
        message: `下書きにあった数値「${number}」が落ちています`,
      })
    }

    const causal = findPhrase(text, causalPhrases)
    if (causal !== undefined) {
      violations.push({
        rule: 'causal_claim',
        key,
        found: causal,
        message: `相関を因果として断定する表現「${causal}」が含まれています`,
      })
    }

    const jargon = findPhrase(text, marketingTerms)
    if (jargon !== undefined) {
      violations.push({
        rule: 'marketing_jargon',
        key,
        found: jargon,
        message: `マーケ用語「${jargon}」が含まれています`,
      })
    }

    const platitude = findPhrase(text, platitudePhrases)
    if (platitude !== undefined) {
      violations.push({
        rule: 'platitude',
        key,
        found: platitude,
        message: `一般論・励ましの表現「${platitude}」が含まれています`,
      })
    }
  }

  // 問いはターンに 1 つだけ。本文が独自に問いを足していないかも合わせて数える
  const questions =
    Object.values(output).reduce(
      (total, text) => total + countQuestionMarks(text),
      0,
    ) + countQuestionMarks(questionText ?? '')
  if (questions > 1) {
    violations.push({
      rule: 'multiple_questions',
      key: 'turn',
      found: `${questions}`,
      message: `1 ターンの質問は 1 つまでですが「？」が ${questions} 個あります`,
    })
  }

  return violations
}
