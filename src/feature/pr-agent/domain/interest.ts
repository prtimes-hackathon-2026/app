/**
 * 4 つの関心。
 *
 * 目的そのものは聞かない。関心の方向を選ばせることが実質的な目的の特定になり、
 * そのまま事例照合の入力になる。相手が自由に語ってきた場合も、
 * 内部でこの 4 分類のどれかに黙って割り当てる (言い直させない)。
 *
 * ラベルと機能カタログの正は pr-metrics 側にある。ここは会話が扱う識別子だけを持つ。
 */
export const interestIds = ['pv', 'media', 'story', 'topic'] as const

export type InterestId = (typeof interestIds)[number]

export function isInterestId(value: string): value is InterestId {
  return (interestIds as readonly string[]).includes(value)
}

/** 分類できなかったときに倒す先。ネタ相談は誰にでも当てはまる */
export const fallbackInterest: InterestId = 'topic'
