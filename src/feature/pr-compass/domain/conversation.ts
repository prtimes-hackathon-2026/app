import { z } from 'zod'

/**
 * 会話の進み方。商談の型に合わせてある。
 *
 *   ① 前回◯◯を出した際、次はこう出そうと言っていたが、やらなかった理由は？
 *   ② 何をアピールしたいか
 *   ③ 提案 → 断られる → その理由から本当のニーズが出る
 *   ④ 設定のズレを指摘して、目的に直結させる
 *
 * 画面は自由入力なので、返答は分類して分岐に落とす。
 * 選択肢は「サジェスト」として本文に添えるだけで、入力を縛らない。
 *
 * 段はターン数では進めない。聞いたことが取れたかどうかを分類器に判定させ、
 * 取れたときだけ次へ進む。取れなければ同じ段に留まって聞き直す。
 */

/** いま何を聞いているか。答えが取れるまでここは動かない */
export type Step =
  | 'diagnosis' // 診断をまだ出していない。ここだけは相手の答えを待たない
  | 'reason' // 止まった理由を聞いている
  | 'interest' // 何をしたいかを聞いている
  | 'react' // 提案への反応を聞いている
  | 'complete' // 書きに行くか人に渡すかが決まった

/** 止まった理由。商談はここから始まる */
export const REASONS = [
  'no_topic', // 出すネタが見つからない
  'no_time', // 時間が取れない
  'no_effect', // 出しても反応が無かった
  'handover', // 担当が変わった
  'none', // 特に理由はない
] as const
export type Reason = (typeof REASONS)[number]

/** 何をしたいか */
export const INTERESTS = [
  'pv', // もっと見てもらいたい
  'media', // メディアに取り上げられたい
  'story', // 背景を知ってほしい
  'topic', // 何を配信すればいいか分からない
] as const
export type Interest = (typeof INTERESTS)[number]

/** 提案を出したあとの反応。「いく／いかない」では拾えない */
export const REACTIONS = [
  'write', // 書いてみる（主導線）
  'more', // 書き方をもっと見たい
  'boss', // 社内で通せるか不安
  'weak', // ピンとこない
  'doubt', // 効果が出るか半信半疑
  'human', // 人と話したい
] as const
export type Reaction = (typeof REACTIONS)[number]

/** ピンとこない、と言われたときの内訳 */
export const OBJECTIONS = [
  'audience', // 届けたい相手が違う
  'content', // 伝えたい内容が違う
  'tried', // 前に似たことを試して駄目だった
  'effort', // 手間がかかりすぎる
] as const
export type Objection = (typeof OBJECTIONS)[number]

export const REASON_SUGGESTIONS: Record<Reason, string> = {
  no_topic: '出すネタが見つからない',
  no_time: '時間が取れない',
  no_effect: '出しても反応が無かった',
  handover: '担当が変わった・引き継いでいない',
  none: '特に理由はない',
}

export const INTEREST_SUGGESTIONS: Record<Interest, string> = {
  pv: 'もっと多くの人に見てもらいたい',
  media: 'メディアに取り上げられたい',
  story: '会社や商品の背景を知ってほしい',
  topic: '何を配信すればいいか分からない',
}

export const OBJECTION_LABELS: Record<Objection, string> = {
  audience: '届けたい相手が違う',
  content: '伝えたい内容が違う',
  tried: '前に似たことを試して駄目だった',
  effort: '手間がかかりすぎる',
}

/** 理由が分かれば関心はほぼ推定できる。関心が取れなかったときの既定値に使う */
export const INTEREST_FROM_REASON: Record<Reason, Interest> = {
  no_topic: 'topic',
  no_time: 'topic',
  no_effect: 'pv',
  handover: 'topic',
  none: 'topic',
}

/**
 * 断られるたびに引き出しを変える。回数だけで数えると
 * 同じ提案の言い換えを繰り返すことになるので、何が合わなかったかで出し分ける。
 */
export const OBJECTION_PLAYBOOK: Record<Objection, string> = {
  content: '別の切り口を出す（種別を変える）',
  audience: '届ける相手を変える',
  effort: 'もっと軽い形にする（既存素材の流用・過去記事の再構成）',
  tried: '他社が実際にどうしたかを、事例そのもので見せる',
}

/** 分類が同じ結果に偏っても手を変えるための順番。開けていない引き出しから使う */
export const OBJECTION_ORDER = [
  'content',
  'audience',
  'effort',
  'tried',
] as const satisfies readonly Objection[]

/** ここまで届かないなら対話では解けない。人に渡す */
export const MAX_OBJECTIONS = 4

/**
 * 同じことを聞き直す上限。分類器が答えを取れない状態が続いたときの逃げ道で、
 * ここに達したら既定に倒して先へ進む。
 * これが無いと、OPENAI_API_KEY が未設定のときに会話が同じ段で止まる。
 */
export const MAX_STALLS = 2

/** 画面のフェーズ表示に合わせる */
export type Phase = 'discovery' | 'free_talk' | 'proposal' | 'complete'

/** 次に何を聞くかがそのままフェーズになる */
export function phaseOf(step: Step): Phase {
  switch (step) {
    case 'diagnosis':
    case 'reason':
      return 'discovery'
    case 'interest':
      return 'free_talk'
    case 'react':
      return 'proposal'
    case 'complete':
      return 'complete'
  }
}

/**
 * これまでのやり取りで確定したこと。
 * サーバは会話を保持しないので、画面がこれをそのまま持ち回る。
 */
export type ConversationState = {
  /** いま何を聞いているか */
  step: Step
  reason: Reason | null
  interest: Interest | null
  /** 断られた回数。MAX_OBJECTIONS に達したら人に渡す */
  objections: number
  /** すでに開けた引き出し。同じ切り口を二度出さない */
  tried: Objection[]
  /** 同じ段で聞き直した回数。MAX_STALLS に達したら既定に倒して進む */
  stalls: number
  handoffToHuman: boolean
}

export const initialState = (): ConversationState => ({
  step: 'diagnosis',
  reason: null,
  interest: null,
  objections: 0,
  tried: [],
  stalls: 0,
  handoffToHuman: false,
})

const stateSchema = z.object({
  step: z.enum(['diagnosis', 'reason', 'interest', 'react', 'complete']),
  reason: z.enum(REASONS).nullable(),
  interest: z.enum(INTERESTS).nullable(),
  objections: z.int().min(0).max(MAX_OBJECTIONS),
  tried: z.array(z.enum(OBJECTIONS)).max(OBJECTIONS.length),
  stalls: z.int().min(0).max(MAX_STALLS),
  handoffToHuman: z.boolean(),
})

/**
 * 画面から戻ってきた状態を検査する。
 * 壊れていたら null を返し、呼び出し側は最初から始める。
 * ここで決まるのはどの下書きを出すかだけで、数値は company_id から引き直す。
 */
export function parseConversationState(
  value: unknown,
): ConversationState | null {
  const parsed = stateSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}
