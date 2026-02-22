"use client"

import { Badge } from "@/components/ui/badge"
import { ScrollReveal } from "@/components/scroll-reveal"
import { Header } from "@/components/header"
import { SiteFooter } from "@/components/site-footer"
import { OpenClawChatWidget } from "@/components/openclaw-chat-widget"

interface LegalPageLayoutProps {
  badge: string
  title: string
  lastUpdated?: string
  children: React.ReactNode
}

export function LegalPageLayout({ badge, title, lastUpdated, children }: LegalPageLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <Header />
      <main className="flex-1">
        <section className="relative overflow-hidden bg-linear-to-b from-hero-gradient-from to-background pt-36 pb-20 lg:pt-44 lg:pb-28">
          {/* Background orbs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <div className="section-orb-1 -top-1/4 -right-1/4 h-125 w-125" />
            <div className="section-orb-2 -bottom-1/3 -left-1/4 h-100 w-100" />
            <div className="absolute inset-0 dot-grid opacity-20" />
          </div>

          <div className="relative mx-auto max-w-3xl px-4 lg:px-8">
            <ScrollReveal className="text-center">
              <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/5 px-4 py-1 text-sm font-medium text-primary">
                {badge}
              </Badge>
              <h1 className="mt-5 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                {title}
              </h1>
              {lastUpdated && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Senast uppdaterad: {lastUpdated}
                </p>
              )}
            </ScrollReveal>

            <ScrollReveal delay={200}>
              <div className="mt-12 space-y-8 text-sm leading-relaxed text-muted-foreground">
                {children}
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>
      <SiteFooter />
      <OpenClawChatWidget formType={`legal:${badge.toLowerCase()}`} />
    </div>
  )
}

export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 font-heading text-lg font-semibold text-foreground">{heading}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  )
}
