import React from "react"
import type { Metadata, Viewport } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { DIdAgentWidget } from '@/components/did-agent-widget'
import './globals.css'

const _inter = Inter({ subsets: ['latin'] })
const _spaceGrotesk = Space_Grotesk({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Flyttsmart - Adressändring online, snabbt och tryggt',
  description:
    'Flyttsmart gör din adressändring enkel, trygg och snabb. Klar på några minuter med säker betalning och krypterad anslutning. Undvik missad post när du flyttar.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#d4a017',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="sv">
      <body className="font-sans antialiased">
        {children}
        <DIdAgentWidget />
        <Analytics />
      </body>
    </html>
  )
}
