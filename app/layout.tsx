import React from "react"
import type { Metadata, Viewport } from 'next'
import { DM_Sans, Playfair_Display } from 'next/font/google'
import { AnalyticsWithConsent } from '@/components/analytics-with-consent'
import { CookieConsentBanner } from '@/components/cookie-consent-banner'
import { JsonLd } from '@/components/json-ld'
import { DIDStreamProvider } from '@/lib/did-stream-context'
import { SmoothScroll } from '@/components/smooth-scroll'
import { ScrollProgress } from '@/components/scroll-progress'
import { absoluteUrl, siteConfig } from '@/lib/site-config'
import {
  createOrganizationStructuredData,
  createServiceStructuredData,
  createWebsiteStructuredData,
} from '@/lib/structured-data'
import './globals.css'

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-sans' })
const playfairDisplay = Playfair_Display({ subsets: ['latin'], variable: '--font-heading' })

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: 'Flytt.io – Flyttanmälan som den borde fungera',
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [...siteConfig.keywords],
  authors: [{ name: siteConfig.name }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: siteConfig.locale,
    url: '/',
    siteName: siteConfig.name,
    title: 'Flytt.io – Flyttanmälan som den borde fungera',
    description: siteConfig.description,
    images: [
      {
        url: absoluteUrl('/media/logos/logo-full.svg'),
        alt: 'Flytt.io',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Flytt.io – Flyttanmälan som den borde fungera',
    description: siteConfig.description,
    images: [absoluteUrl('/media/logos/logo-full.svg')],
  },
  robots: {
    index: true,
    follow: true,
  },
  generator: 'Flytta.nu',
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  themeColor: '#1A1A2E',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="sv"
      suppressHydrationWarning
      className={`${dmSans.variable} ${playfairDisplay.variable}`}
      style={{ position: "relative" }}
    >
      <body className="font-sans antialiased" style={{ position: "relative" }}>
        <JsonLd
          id="flytt-organization-jsonld"
          data={createOrganizationStructuredData()}
        />
        <JsonLd
          id="flytt-website-jsonld"
          data={createWebsiteStructuredData()}
        />
        <JsonLd
          id="flytt-service-jsonld"
          data={createServiceStructuredData()}
        />
        <DIDStreamProvider>
          <SmoothScroll />
          <ScrollProgress />
          {children}
          <CookieConsentBanner />
        </DIDStreamProvider>
        <AnalyticsWithConsent />
      </body>
    </html>
  );
}
