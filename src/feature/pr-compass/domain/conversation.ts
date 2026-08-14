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
 */

export type Step =
  | 'diagnosis' // 診断を出して、止まった理由を聞く
  | 'reason' // 理由に応じた処方を出して、関心を確かめる
  | 'proposal' // 目標・見込み・出し方・機能・事例を一度に
  | 'react' // 提案への反応を受ける
  | 'complete'

/** 止まった理由。商談はここから始まる */
export type Reason =
  | 'no_topic' // 出すネタが見つからない
  | 'no_time' // 時間が取れない
  | 'no_effect' // 出しても反応が無かった
  | 'handover' // 担当が変わった
  | 'none' // 特に理由はない

/** 何をしたいか */
export type Interest =
  | 'pv' // もっと見てもらいたい
  | 'media' // メディアに取り上げられたい
  | 'story' // 背景を知ってほしい
  | 'topic' // 何を配信すればいいか分からない

/** 提案を出したあとの反応。「いく／いかない」では拾えない */
export type Reaction =
  | 'write' // 書いてみる（主導線）
  | 'more' // 書き方をもっと見たい
  | 'boss' // 社内で通せるか不安
  | 'weak' // ピンとこない
  | 'doubt' // 効果が出るか半信半疑
  | 'human' // 人と話したい

/** ピンとこない、と言われたときの内訳 */
export type Objection =
  | 'audience' // 届けたい相手が違う
  | 'content' // 伝えたい内容が違う
  | 'tried' // 前に似たことを試して駄目だった
  | 'effort' // 手間がかかりすぎる

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

/** 理由が分かれば関心はほぼ推定できる。質問を1つ減らすために使う */
export const INTEREST_FROM_REASON: Record<Reason, Interest> = {
  no_topic: 'topic',
  no_time: 'topic',
  no_effect: 'pv',
  handover: 'topic',
  none: 'topic',
}

/**
 * 断られるたびに引き出しを変える。回数だけで数えると
 * 同じ提案の言い換えを繰り返すことになる。
 */
export const OBJECTION_PLAYBOOK = [
  '別の切り口を出す（種別を変える／届ける相手を変える）',
  'もっと軽い形にする（短いリリース・既存素材の流用・過去記事の再構成）',
  '他社が実際にどうしたかを、事例そのもので見せる',
] as const

/** ここまで届かないなら対話では解けない。人に渡す */
export const MAX_OBJECTIONS = 4

/** 画面のフェーズ表示に合わせる */
export type Phase = 'discovery' | 'free_talk' | 'proposal' | 'complete'

export function phaseOf(step: Step): Phase {
  switch (step) {
    case 'diagnosis':
      return 'discovery'
    case 'reason':
      return 'free_talk'
    default:
      // react まで来ても会話は終わらない。書きに行くか人に渡すかが決まって
      // 初めて complete になるので、それは呼び出し側が明示的に指定する
      return 'proposal'
  }
}

/** これまでのやり取りの要約。会話は毎回作り直すので、履歴から復元する */
export type ConversationState = {
  step: Step
  reason: Reason | null
  interest: Interest | null
  /** 断られた回数。MAX_OBJECTIONS に達したら人に渡す */
  objections: number
  handoffToHuman: boolean
  /** 書きに行くか人に渡すかが決まった。ここで初めて会話を閉じる */
  finished: boolean
}
