import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 依存を同梱した単体サーバーを出力し、Docker イメージを小さく保つ
  output: 'standalone',
  reactStrictMode: true,
  // 型エラーはビルドでも落とす (既定値だが意図として明示する)
  typescript: { ignoreBuildErrors: false },
}

export default nextConfig
