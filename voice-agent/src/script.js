/**
 * 画面用の文章を、耳で聞いて分かる台本に落とす。
 *
 * 数値は turns.js / metrics.js が確定させたものをそのまま運ぶ。ここでは作らない。
 * 段落ごとに切るのは、1段落目を先に喋り始めるため（全部揃うまで黙っていると間が持たない）。
 * block は「この段を喋るとき画面のどれを出すか」の対応。
 */

/** 目で読む前提の表記を、声に直す */
const forSpeech = (s) =>
  String(s || '')
    .replace(/[■●▲]/g, '')
    .replace(/PV/g, 'ピーブイ')
    .replace(/(\d)\s*〜\s*(\d)/g, '$1から$2')
    .replace(/【】/g, 'すみつきカッコ') // 記号そのものが機能名になっている項目がある
    .replace(/[「」『』]/g, ' ') // 引用符は読み上げると邪魔になる
    .replace(/\s+/g, ' ')
    .trim()

const seg = (block, text) => {
  const t = forSpeech(text)
  return t ? { block, text: t } : null
}

/** ターン0の台本。名乗り → 現在地 → 業種の実績 → 本数と確率 → 再開した企業 → 未使用機能 → 問い */
export function script0(out) {
  const diagnosis = out.blocks.find((b) => b.type === 'diagnosis')
  const unused = out.blocks.find((b) => b.type === 'unused_features')
  const n = diagnosis?.facts.total_releases
  const months = diagnosis?.facts.stopped_months

  const opening = [
    `${out.company.name}さんの状況を確認しました。`,
    n != null ? `配信は${n}本、` : '',
    months != null ? `そこから${months}か月止まっています。` : '',
  ].join('')

  const features = unused?.items?.length
    ? `あわせて、まだ使われていない機能が${unused.items.length}つあります。` +
      `${unused.items.map((i) => i.label).join('、')}です。`
    : ''

  return [
    seg('diagnosis', opening),
    seg('hitcurve', out.narrative.position),
    seg('hitcurve', out.narrative.lottery),
    seg('resume', out.narrative.resume),
    seg('unused_features', features),
    seg('question', 'どれから手を付けましょうか。'),
  ]
    .filter(Boolean)
    .map((s, i) => ({ id: `t0-${i}`, ...s }))
}

/** ターン1の台本。見込み → 時間では上がらない → 跳ねやすい種別 → 使う機能 → 確認 */
export function script1(out) {
  return [
    seg('outlook', out.narrative.outlook),
    seg('period', out.narrative.time),
    seg('trends', out.narrative.trend),
    seg('features', out.narrative.feature),
    seg('question', 'この方向で進めてよろしいですか。'),
  ]
    .filter(Boolean)
    .map((s, i) => ({ id: `t1-${i}`, ...s }))
}
