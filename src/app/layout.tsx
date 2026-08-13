import type { Metadata, Viewport } from 'next'
import '@/shared/ui/styles/tokens.css'
import '@/shared/ui/styles/base.css'

export const metadata: Metadata = {
  title: 'app',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
