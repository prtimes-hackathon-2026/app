import type { NextConfig } from 'next'

/**
 * ダッシュボードから配る Drizzle のスキーマ定義。
 *
 * 中身をソースとして読むだけで import はしないので、トレースが自動では拾えない。
 * standalone 出力に載せないと本番だけ一覧が空になる。
 * (`src/feature/schema-files/infrastructure/schema-file-repository.fs.ts` と対にする)
 */
const schemaFilePatterns = [
  'src/external/db/app/schema/*.ts',
  'src/external/db/stats/schema/*.ts',
  'drizzle/stats/*.ts',
]

const nextConfig: NextConfig = {
  // 依存を同梱した単体サーバーを出力し、Docker イメージを小さく保つ
  output: 'standalone',
  outputFileTracingIncludes: {
    '/dashboard': schemaFilePatterns,
    '/api/schema-files/*': schemaFilePatterns,
  },
  reactStrictMode: true,
  // 型エラーはビルドでも落とす (既定値だが意図として明示する)
  typescript: { ignoreBuildErrors: false },
  // 入口は管理画面だけなので、`/` はダッシュボードへ送る。
  // 後で `/` にランディングを置く可能性を残し、ブラウザに焼き付く 308 は避ける
  async redirects() {
    return [{ source: '/', destination: '/dashboard', permanent: false }]
  },
}

export default nextConfig
