/**
 * 画面に出す数値と日付の書式。ログイン画面と PR羅針盤 が同じ書式を使う。
 *
 * ロケールとタイムゾーンを明示しているのは、サーバとブラウザで既定値が違うと
 * ハイドレーションで表示がずれるため。数字が主役の画面なので、
 * 「値が無い」ことは空欄ではなく決まった記号で埋めて、桁の読み違いを防ぐ。
 */

const numberFormat = new Intl.NumberFormat('ja-JP')

// 効果差分は 10.3% のような小数が出るので 1 桁だけ残す
const percentFormat = new Intl.NumberFormat('ja-JP', {
  maximumFractionDigits: 1,
})

const dateFormat = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export const blank = '—'

export function formatNumber(value: number | null): string {
  return value === null ? blank : numberFormat.format(value)
}

export function formatPercent(value: number | null): string {
  return value === null ? blank : `${percentFormat.format(value)}%`
}

export function formatDate(value: Date | null): string {
  return value === null ? blank : dateFormat.format(value)
}
