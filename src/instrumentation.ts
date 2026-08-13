/**
 * サーバーインスタンスの起動時に 1 度だけ呼ばれ、リクエストを受け付ける前に
 * 完了する。アプリ用 DB のマイグレーションはここで流す。
 */
export async function register() {
  // Edge ランタイムでは DB ドライバもファイル読み込みも使えない
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // 副作用のある import は register の中に閉じ込める (Next.js の推奨)
  const { migrateAppDbOnStartup } = await import('@/external/db/app/migrate')
  await migrateAppDbOnStartup()
}
