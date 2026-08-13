// PR TIMES公式サイト / PR TIMES MAGAZINE で実在を確認した機能のみ
export const FEATURES = {
  pv: [
    { key: 'editor', name: 'PR Editor（新エディター）', note: '画像・見出しで読まれ方が変わる', optional: false },
    { key: 'analytics', name: '分析データ', note: '配信後に見るべき指標を確認できる', optional: false },
  ],
  media: [
    { key: 'medialist', name: 'メディアリスト', note: '届けたい媒体を選んで配信できる', optional: false },
    { key: 'clipping', name: 'Webクリッピング（クリップ調査）', note: '掲載されたかを自動で追える', optional: false },
    { key: 'partner', name: 'パートナーメディアへの転載', note: '提携媒体に広がる', optional: false },
  ],
  story: [
    { key: 'story', name: 'PR TIMES STORY', note: '背景や想いを物語として出せる', optional: false },
    { key: 'presskit', name: 'プレスキット', note: '報道関係者向けの資料をまとめて置ける', optional: false },
  ],
  topic: [
    { key: 'category', name: 'カテゴリ・キーワード設定', note: '拾われる経路が増える', optional: false },
    { key: 'magazine', name: 'PR TIMES MAGAZINE', note: '配信ネタの作り方が載っている', optional: false },
  ],
};

// マガジンは記事数が少ないので検索せず対応表で持つ
export const ARTICLES = {
  pv: [
    ['プレスリリース配信後に見るべきデータと効果改善のポイント',
      'https://prtimes.com/magazine/prtimes-analysis-data-review/'],
    ['新エディターを使ってプレスリリースを作成！活用ポイントや配信事例を紹介',
      'https://prtimes.com/magazine/press-release-new-editor-case-study/'],
  ],
  media: [
    ['メディアリストの作成・設定方法',
      'https://prtimes.com/magazine/medialist-configuration/'],
    ['メディアリスト用に媒体選定する7つの方法・観点とは？',
      'https://prtimes.com/magazine/category/pr-know-how/'],
  ],
  story: [
    ['PR TIMESのプレスキット機能の使い方や活用方法は？',
      'https://prtimes.com/magazine/category/pr-know-how/'],
  ],
  topic: [
    ['PR TIMESノウハウ一覧',
      'https://prtimes.com/magazine/category/pr-know-how/'],
  ],
};

export const INTERESTS = [
  { id: 'pv', label: 'もっと多くの人に見てもらいたい' },
  { id: 'media', label: 'メディアに取り上げられたい' },
  { id: 'story', label: '会社や商品の背景を知ってほしい' },
  { id: 'topic', label: '何を配信すればいいか分からない' },
];

export const INTEREST_LABEL = Object.fromEntries(INTERESTS.map((i) => [i.id, i.label]));
