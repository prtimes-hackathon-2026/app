export type NarrationNumberValidation = {
  passed: boolean
  source: readonly string[]
  output: readonly string[]
  missing: readonly string[]
  unexpected: readonly string[]
}

function extractNumbers(text: string): string[] {
  return (
    text
      .normalize('NFKC')
      // 1,000 と 1000 は同じ値として扱う。
      .replace(/(?<=\d),(?=\d)/g, '')
      .match(/\d+(?:\.\d+)?/g) ?? []
  )
}

function subtract(source: readonly string[], target: readonly string[]) {
  const remaining = [...target]
  const difference: string[] = []

  for (const token of source) {
    const index = remaining.indexOf(token)
    if (index < 0) difference.push(token)
    else remaining.splice(index, 1)
  }

  return difference
}

/**
 * Narrator が下書きの数字を追加・削除・変更していないかを機械的に検査する。
 * 違反時の再生成はせず、呼び出し側が検証済みの下書きへ即時フォールバックする。
 */
export function validateNarrationNumbers(
  draft: string,
  narration: string,
): NarrationNumberValidation {
  const source = extractNumbers(draft)
  const output = extractNumbers(narration)
  const missing = subtract(source, output)
  const unexpected = subtract(output, source)

  return {
    passed: missing.length === 0 && unexpected.length === 0,
    source,
    output,
    missing,
    unexpected,
  }
}
