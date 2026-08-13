/**
 * 統計 DB 由来の日次集計。
 *
 * agentId は agents feature の識別子と同じ値を指すが、feature 同士を直接結合させない
 * ために型としては素の string で受ける。突き合わせは呼び出し側 (app 層) の責務。
 */
export type AgentDailyStat = {
  readonly agentId: string
  /** YYYY-MM-DD */
  readonly date: string
  readonly runCount: number
  readonly successCount: number
}

export type DateRange = {
  /** YYYY-MM-DD (含む) */
  readonly from: string
  /** YYYY-MM-DD (含む) */
  readonly to: string
}
