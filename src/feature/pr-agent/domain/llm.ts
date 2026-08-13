import type { CompanyFactsSnapshot } from './facts'
import type { InterestId } from './interest'

/**
 * LLM に任せる 3 つの仕事。いずれも会話を駆動しない。
 *
 *   数値・判定・機能選定 … 決定的なコード
 *   文章                 … ここ
 *
 * どのポートも「落ちてもよい」ように設計する。実装は例外を投げず、
 * 失敗を null で返す。呼び出し側はテンプレのまま処理を続ける。
 */

/** 日本語ラベルの辞書。生の指標名は渡さない (意味を誤読するため) */
export type FactSheet = Readonly<Record<string, string>>

/** テンプレで組んだ下書き。LLM はこれを言い換えるだけ */
export type Draft = Readonly<Record<string, string>>

export interface NarratorPort {
  /**
   * draft を、その会社の商品に即した言葉に書き直す。
   * 戻り値は draft と同じキー集合でしか上書きしない (ホワイトリスト)。
   * 失敗したら null を返す。
   */
  narrate(input: {
    readonly facts: FactSheet
    readonly draft: Draft
  }): Promise<Draft | null>
}

export interface ClassifierPort {
  /** 自由発話を 4 分類に割り当てる。失敗したら null */
  classify(text: string): Promise<InterestId | null>
}

export interface ProfilerPort {
  /**
   * 3 層 (トップ / ミドル / ボトム) を裏で推定する。
   * 相手には質問しない。提示物にも出さない。失敗したら null
   */
  profile(input: {
    readonly snapshot: CompanyFactsSnapshot
    readonly interest: InterestId | null
  }): Promise<{
    readonly top: string
    readonly middle: string
    readonly bottom: string
  } | null>
}
