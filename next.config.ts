import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 依存を同梱した単体サーバーを出力し、Docker イメージを小さく保つ
  output: 'standalone',
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
