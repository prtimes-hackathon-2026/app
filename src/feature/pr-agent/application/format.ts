/**
 * 事実の辞書と下書きに使う表記。
 *
 * 数値はすべてポートから来た実測値で、ここでは書き方しか決めない。
 * 丸めたり足したりしない (数値を作れる場所を 1 か所も増やさない)。
 */

/** 桁区切り。サーバーのロケールに左右されないようロケールを明示する */
export function count(value: number): string {
  return value.toLocaleString('ja-JP')
}

/** 「—」は事実が取れなかったことを表す。LLM にはこの記号のまま渡す */
export const unknownFact = '—'

export function percent(value: number | null | undefined): string {
  return value === null || value === undefined ? unknownFact : `${value}%`
}

/**
 * 経過期間の見出し。期間カーブの刻みは 3/6/12/24/36 か月で、
 * 最後の行が 36 か月なら「3年」になる。プロトタイプは「3年」と決め打ちしていたが、
 * 業種によっては最後の行が 36 か月まで届かないので、行の値から作る。
 */
export function elapsedLabel(months: number): string {
  return months >= 12 ? `${Math.round(months / 12)}年` : `${months}か月`
}
