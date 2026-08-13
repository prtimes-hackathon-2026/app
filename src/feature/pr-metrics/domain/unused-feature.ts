import type { FeatureUsage } from './company-position'
import type { LeverKey, Levers } from './metrics'

/**
 * 過去の配信データから「使っていない機能」を検出する。相手には聞かない。
 *
 * 検出したもののうち、効果差分 (Levers) も分かっているものを先に出す。
 * 効果差分が無いものは「設定できます」に留め、「効果があります」とは言わない。
 */

export type FeatureImpact = {
  readonly withPct: number
  readonly withoutPct: number
  readonly ratio: number
  readonly n: number
}

export type UnusedFeature = {
  readonly key: string
  readonly label: string
  /** 検出の根拠。「平均0.4件」「未設定」など */
  readonly detected: string
  readonly impact: FeatureImpact | null
}

function impactOf(levers: Levers, key: LeverKey): FeatureImpact | null {
  const lever = levers[key]
  if (!lever?.ratio) return null
  return {
    withPct: lever.on.hitPct,
    withoutPct: lever.off.hitPct,
    ratio: lever.ratio,
    n: lever.on.n + lever.off.n,
  }
}

export function detectUnusedFeatures(
  usage: FeatureUsage,
  levers: Levers,
): readonly UnusedFeature[] {
  if (usage.total === 0) return []

  const items: UnusedFeature[] = []

  if (usage.avgKeywords < 3) {
    items.push({
      key: 'keyword',
      label: 'キーワード設定',
      detected: `平均${usage.avgKeywords.toFixed(1)}件`,
      impact: impactOf(levers, 'keyword'),
    })
  }
  if (usage.noImage === usage.total) {
    items.push({
      key: 'main_image',
      label: 'メイン画像',
      detected: '未設定',
      impact: impactOf(levers, 'main_image'),
    })
  }
  if (usage.noSubtitle === usage.total) {
    items.push({
      key: 'subtitle',
      label: 'サブタイトル',
      detected: '未設定',
      impact: null,
    })
  }
  if (usage.noVideo === usage.total) {
    items.push({
      key: 'video',
      label: '動画の掲載',
      detected: '未設定',
      impact: null,
    })
  }
  if (usage.titlesWithNumber === 0) {
    items.push({
      key: 'title_number',
      label: 'タイトルに数字を入れる',
      detected: '使っていない',
      impact: impactOf(levers, 'title_number'),
    })
  }
  if (usage.titlesWithBracket === 0) {
    items.push({
      key: 'title_bracket',
      label: 'タイトルの【】',
      detected: '使っていない',
      impact: impactOf(levers, 'title_bracket'),
    })
  }
  if (usage.releaseTypes <= 1 && usage.total >= 2) {
    items.push({
      key: 'type',
      label: 'リリース種別の使い分け',
      detected: '1種類のみ',
      impact: null,
    })
  }

  // 効果差分が分かっているものを先に出す
  return [...items].sort(
    (a, b) => Number(Boolean(b.impact)) - Number(Boolean(a.impact)),
  )
}
