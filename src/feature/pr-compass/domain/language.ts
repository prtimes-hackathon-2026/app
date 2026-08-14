import type { Interest, Objection, Reaction, Reason } from './conversation'

/** Skill ごとに差し替えられる言い換え方針。全体の禁止事項より優先しない。 */
export type NarrationPolicy = {
  objective: string
  instructions: readonly string[]
  prohibited: readonly string[]
}

/** 自由入力を、こちらの分岐に落とす */
export type Classifier = {
  reason(text: string): Promise<Reason>
  interest(text: string): Promise<Interest>
  reaction(text: string): Promise<Reaction>
  objection(text: string): Promise<Objection>
}

/**
 * 下書きを、その会社に向いた自然な文に書き直す。
 * 数値を作らせないため、渡すのは「日本語ラベル付きの事実」と「下書き」だけにする。
 * 生の指標名を渡すと意味を取り違える（実際に「平均評価ポイントは6」と誤読した）。
 */
export type Narrator = {
  speak(input: {
    facts: Record<string, string>
    draft: string
    /** 直前までのやり取り。口調を合わせるために渡す */
    history: readonly { role: 'user' | 'assistant'; content: string }[]
    /** 選択された Skill 固有の目的・手順・禁止事項 */
    policy?: NarrationPolicy
  }): Promise<string>

  /** 左パネルに出す聞き取りメモ。事実と、相手の反応の傾向を自然文で */
  memo(input: {
    facts: Record<string, string>
    history: readonly { role: 'user' | 'assistant'; content: string }[]
    previous: string
  }): Promise<string>
}
