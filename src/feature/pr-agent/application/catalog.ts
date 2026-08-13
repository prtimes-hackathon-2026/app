import { fallbackInterest, type InterestId } from '../domain/interest'

/**
 * 会話が提示に使うカタログ。
 *
 * 関心のラベル・機能カタログ・マガジン記事・配信本数のバケットは、いずれも正が
 * pr-metrics 側にある。domain / application は他 feature を知らないため、
 * 値そのものを配線時 (index.ts) に注入してもらう。
 *
 * 提案する機能をここからしか選べなくすることで、
 * 「実在しない機能を提案しない」が構造的に守られる。LLM は機能名を作れない。
 */

export type CatalogFeature = {
  readonly key: string
  readonly name: string
  readonly note: string
}

export type CatalogArticle = {
  readonly title: string
  readonly url: string
}

export type ConversationCatalog = {
  readonly interests: readonly {
    readonly id: InterestId
    readonly label: string
  }[]
  readonly features: Readonly<Record<InterestId, readonly CatalogFeature[]>>
  readonly articles: Readonly<Record<InterestId, readonly CatalogArticle[]>>
  /** 配信本数 → バケットの表示名。刻みの正も pr-metrics 側なので関数ごと注入する */
  readonly bucketOf: (releaseCount: number) => string
}

export function interestLabel(
  catalog: ConversationCatalog,
  interest: InterestId,
): string {
  return catalog.interests.find((i) => i.id === interest)?.label ?? interest
}

/** カタログが空の関心に当たったら、誰にでも当てはまる関心の機能を出す */
export function featuresOf(
  catalog: ConversationCatalog,
  interest: InterestId,
): readonly CatalogFeature[] {
  const items = catalog.features[interest]
  return items?.length ? items : (catalog.features[fallbackInterest] ?? [])
}

export function articlesOf(
  catalog: ConversationCatalog,
  interest: InterestId,
): readonly CatalogArticle[] {
  const items = catalog.features[interest]
  const key = items?.length ? interest : fallbackInterest
  return catalog.articles[key] ?? []
}
