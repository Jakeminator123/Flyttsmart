"use client"

import { X, Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ScrollReveal } from "@/components/scroll-reveal"

const traditional = [
  "Flera sajter",
  "Manuell ifyllnad",
  "Lätt att missa saker",
]

const flyttio = [
  "En inloggning",
  "Automatisk flyttanmälan",
  "Fördelar direkt på nya adressen",
]

export function ComparisonSection() {
  return (
    <section className="relative overflow-hidden bg-section-alt py-28 lg:py-36">
      <div className="section-divider absolute top-0 left-0 right-0" />

      {/* Animated background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="section-orb-2 -top-1/4 -right-1/4 h-125 w-125" />
        <div className="section-orb-1 -bottom-1/3 -left-1/4 h-100 w-100" />
      </div>

      <div className="mx-auto max-w-4xl px-4 lg:px-8">
        <ScrollReveal className="text-center">
          <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/5 px-4 py-1 text-sm font-medium text-primary">
            Jämförelse
          </Badge>
          <h2 className="mt-5 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Traditionellt vs
            <span className="text-gradient"> Flytt.io</span>
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={200}>
          <div className="mt-14 grid gap-6 sm:grid-cols-2">
            {/* Traditional */}
            <div className="gradient-border rounded-2xl border border-border/50 bg-card p-8">
              <h3 className="mb-6 font-heading text-lg font-semibold text-muted-foreground">
                Traditionellt
              </h3>
              <ul className="space-y-4">
                {traditional.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                      <X className="h-3.5 w-3.5 text-destructive" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Flytt.io */}
            <div className="gradient-border rounded-2xl border border-primary/30 bg-card p-8 shadow-lg shadow-primary/10">
              <h3 className="mb-6 font-heading text-lg font-semibold text-primary">
                Med Flytt.io
              </h3>
              <ul className="space-y-4">
                {flyttio.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-foreground font-medium">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-chart-5/10">
                      <Check className="h-3.5 w-3.5 text-chart-5" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
