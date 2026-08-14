import type { Session } from './session'

/**
 * セッションを持ち歩ける文字列にするポート。
 *
 * どこに保存するか (Cookie) は app 層の都合なので、ここでは知らない。
 * 実装は改ざんを検出できることと、期限切れを `read` で弾くことだけを約束する。
 */
export interface SessionTokenCodec {
  /** セッションに署名する。期限はセッション自身が持つ */
  issue(session: Session): Promise<string>
  /** 署名と期限を確かめる。読めない・改ざん・期限切れはすべて null */
  read(token: string): Promise<Session | null>
}
