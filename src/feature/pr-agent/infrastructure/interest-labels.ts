import type { InterestId } from '../domain/interest'

/**
 * 4 つの関心を LLM に見せるときの言葉。
 *
 * ラベルの正は pr-metrics 側にあるが、他 feature の内部は参照できない。
 * ここに置いてあるのは画面に出すラベルではなく、分類と推定の手がかりとして
 * LLM に読ませる文言。`pv` のような識別子をそのまま渡すと意味を推測で埋められるため、
 * プロンプトに入るのは必ずこちらの日本語にする。
 *
 * Record<InterestId, string> なので、関心が増減すればここが型で落ちる。
 */
export const interestLabels: Record<InterestId, string> = {
  pv: 'もっと多くの人に見てもらいたい',
  media: 'メディアに取り上げられたい',
  story: '会社や商品の背景を知ってほしい',
  topic: '何を配信すればいいか分からない',
}
