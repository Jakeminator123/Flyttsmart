"use client"

import Link from "next/link"
import { ArrowRight, MessageCircle, Shield, Clock, Lock, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollReveal } from "@/components/scroll-reveal"

const highlights = [
  { icon: Clock, text: "Klar på några minuter" },
  { icon: Shield, text: "Säker betalning" },
  { icon: Lock, text: "Krypterad anslutning" },
  { icon: CheckCircle, text: "Bekräftelse direkt på mejl" },
]

export function CtaSection() {
  return (
    <section
      id="gor-adressandring"
      className="relative overflow-hidden bg-linear-to-b from-background to-hero-gradient-from py-24 lg:py-32"
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-border to-transparent" />

      <div className="pointer-events-none absolute top-0 left-1/4 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />

      <div className="relative mx-auto max-w-4xl px-4 text-center lg:px-8">
        <ScrollReveal>
          <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-4 py-1 text-sm font-medium text-primary">
            Kom igång
          </Badge>
        </ScrollReveal>

        <ScrollReveal delay={100}>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-foreground text-balance sm:text-4xl lg:text-5xl">
            Redo att flytta smart?
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={200}>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Gör din adressändring online idag med Flyttsmart. Det tar bara några
            minuter och du får bekräftelse direkt på mejl.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={300}>
          <Card className="mx-auto mt-10 max-w-lg border-primary/20 bg-card/80 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center gap-6 p-8">
              <div className="grid w-full grid-cols-2 gap-3">
                {highlights.map((h) => (
                  <div key={h.text} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <h.icon className="h-4 w-4 shrink-0 text-primary" />
                    <span>{h.text}</span>
                  </div>
                ))}
              </div>

              <div className="flex w-full flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <div className="absolute -inset-1 rounded-full bg-primary/20 animate-pulse-ring" />
                  <Button
                    asChild
                    size="lg"
                    className="relative w-full rounded-full text-base font-semibold shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
                  >
                    <Link href="/adressandring">
                      Gör adressändring
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="rounded-full text-base bg-transparent"
                >
                  <a href="#kontakt">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Support
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>
      </div>
    </section>
  )
}
