/**
 * 機能カタログ。公式サイト / PR TIMES MAGAZINE で実在を確認した機能だけを載せる。
 *
 * 提案する機能は必ずここから選ぶ。LLM に機能名を生成させない。
 * そうすることで「実在しない機能の提案」が構造的に起きなくなる。
 */

export const interests = [
  { id: 'pv', label: 'もっと多くの人に見てもらいたい' },
  { id: 'media', label: 'メディアに取り上げられたい' },
  { id: 'story', label: '会社や商品の背景を知ってほしい' },
  { id: 'topic', label: '何を配信すればいいか分からない' },
] as const

export type InterestId = (typeof interests)[number]['id']

export const interestIds = interests.map((i) => i.id) as readonly InterestId[]

export const interestLabel: Record<InterestId, string> = Object.fromEntries(
  interests.map((i) => [i.id, i.label]),
) as Record<InterestId, string>

export function isInterestId(value: string): value is InterestId {
  return (interestIds as readonly string[]).includes(value)
}

export type PrFeature = {
  readonly key: string
  readonly name: string
  readonly note: string
}

export const featuresByInterest: Record<InterestId, readonly PrFeature[]> = {
  pv: [
    {
      key: 'editor',
      name: 'PR Editor（新エディター）',
      note: '画像・見出しで読まれ方が変わる',
    },
    {
      key: 'analytics',
      name: '分析データ',
      note: '配信後に見るべき指標を確認できる',
    },
  ],
  media: [
    {
      key: 'medialist',
      name: 'メディアリスト',
      note: '届けたい媒体を選んで配信できる',
    },
    {
      key: 'clipping',
      name: 'Webクリッピング（クリップ調査）',
      note: '掲載されたかを自動で追える',
    },
    {
      key: 'partner',
      name: 'パートナーメディアへの転載',
      note: '提携媒体に広がる',
    },
  ],
  story: [
    {
      key: 'story',
      name: 'PR TIMES STORY',
      note: '背景や想いを物語として出せる',
    },
    {
      key: 'presskit',
      name: 'プレスキット',
      note: '報道関係者向けの資料をまとめて置ける',
    },
  ],
  topic: [
    {
      key: 'category',
      name: 'カテゴリ・キーワード設定',
      note: '拾われる経路が増える',
    },
    {
      key: 'magazine',
      name: 'PR TIMES MAGAZINE',
      note: '配信ネタの作り方が載っている',
    },
  ],
}

export type MagazineArticle = {
  readonly title: string
  readonly url: string
}

/** マガジンは記事数が少ないので検索せず対応表で持つ */
export const articlesByInterest: Record<
  InterestId,
  readonly MagazineArticle[]
> = {
  pv: [
    {
      title: 'プレスリリース配信後に見るべきデータと効果改善のポイント',
      url: 'https://prtimes.com/magazine/prtimes-analysis-data-review/',
    },
    {
      title:
        '新エディターを使ってプレスリリースを作成！活用ポイントや配信事例を紹介',
      url: 'https://prtimes.com/magazine/press-release-new-editor-case-study/',
    },
  ],
  media: [
    {
      title: 'メディアリストの作成・設定方法',
      url: 'https://prtimes.com/magazine/medialist-configuration/',
    },
    {
      title: 'メディアリスト用に媒体選定する7つの方法・観点とは？',
      url: 'https://prtimes.com/magazine/category/pr-know-how/',
    },
  ],
  story: [
    {
      title: 'PR TIMESのプレスキット機能の使い方や活用方法は？',
      url: 'https://prtimes.com/magazine/category/pr-know-how/',
    },
  ],
  topic: [
    {
      title: 'PR TIMESノウハウ一覧',
      url: 'https://prtimes.com/magazine/category/pr-know-how/',
    },
  ],
}
