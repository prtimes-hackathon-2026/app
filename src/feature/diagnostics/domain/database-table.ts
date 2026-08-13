/** このアプリが接続するデータベースの識別子 */
export const databaseNames = ['app', 'stats'] as const

export type DatabaseName = (typeof databaseNames)[number]

export type DatabaseTable = {
  readonly schema: string
  readonly name: string
}

/**
 * 1 つのデータベースについてのテーブル一覧の取得結果。
 * 疎通確認が目的なので、失敗も「結果の一種」として値で表す。
 * こうしておくと片方の DB が落ちていても、もう片方の状態は画面で確認できる。
 */
export type DatabaseTableCatalog =
  | {
      readonly database: DatabaseName
      readonly ok: true
      readonly tables: readonly DatabaseTable[]
    }
  | {
      readonly database: DatabaseName
      readonly ok: false
      readonly error: string
    }
