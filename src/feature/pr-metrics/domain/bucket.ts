/**
 * 配信本数のバケット。
 *
 * 当たり率カーブはこの刻みで集計する。プロトタイプ (voice-agent/src/metrics.js) の
 * 刻みをそのまま引き継いでいる。SQL 側の CASE 式と必ず同じ境界にすること。
 */
export const bucketLabels = [
  '1本',
  '2本',
  '3本',
  '4〜5本',
  '6〜10本',
  '11〜20本',
  '21本以上',
] as const

export type BucketLabel = (typeof bucketLabels)[number]

export function bucketOf(releaseCount: number): BucketLabel {
  if (releaseCount <= 1) return '1本'
  if (releaseCount === 2) return '2本'
  if (releaseCount === 3) return '3本'
  if (releaseCount <= 5) return '4〜5本'
  if (releaseCount <= 10) return '6〜10本'
  if (releaseCount <= 20) return '11〜20本'
  return '21本以上'
}
