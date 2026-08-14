/**
 * 合言葉の照合。
 *
 * 一致したかどうかで比較にかかる時間が変わらないように、
 * 先頭から違いを見つけても打ち切らず、必ず最後まで走らせる。
 * 総当たりを防ぐ仕組みではないが、応答時間から正解の長さや先頭の文字が
 * 漏れる形にはしない。
 */
const encoder = new TextEncoder()

export function matchesPassword(input: string, expected: string): boolean {
  const a = encoder.encode(input)
  const b = encoder.encode(expected)

  // 長さの違いもここで畳み込む。長さが違えば diff は 0 にならない
  let diff = a.length ^ b.length
  const length = Math.max(a.length, b.length)
  for (let i = 0; i < length; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  }

  return diff === 0
}
