"use client"

import Link from "next/link"
import Image from "next/image"
import dynamic from "next/dynamic"
import { ArrowRight, MessageCircle, Shield, Clock, Lock, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollReveal } from "@/components/scroll-reveal"

const FloatingLines = dynamic(() => import("@/components/floating-lines"), {
  ssr: false,
})

const CTA_GRADIENT = ["#1B3BA2", "#4A80E0", "#D4A843"]

const highlights = [
  { icon: Clock, text: "Klar på 2 minuter" },
  { icon: Shield, text: "100% gratis" },
  { icon: Lock, text: "BankID-inloggning" },
  { icon: CheckCircle, text: "GDPR-godkänd" },
]

export function CtaSection() {
  return (
    <section
      id="gor-adressandring"
      className="relative overflow-hidden py-28 lg:py-36"
    >
      <div className="section-divider absolute top-0 left-0 right-0" />

      {/* Background mesh + FloatingLines */}
      <div className="hero-mesh opacity-50" />
      <div className="hero-mesh-accent opacity-30" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.12]">
        <FloatingLines
          linesGradient={CTA_GRADIENT}
          enabledWaves={["bottom", "middle"]}
          lineCount={[3, 4]}
          lineDistance={[10, 6]}
          animationSpeed={0.4}
          interactive={false}
          parallax={false}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-30" />

      <div className="relative mx-auto max-w-4xl px-4 text-center lg:px-8">
        {/* "Before" contrast – stressed mover */}
        <ScrollReveal>
          <div className="mx-auto mb-10 flex max-w-md items-center gap-5 rounded-2xl border border-border/40 bg-card/60 p-4 text-left shadow-lg backdrop-blur-sm">
            <Image
              src="/images/ledsen_man.webp"
              alt="En stressad man omgiven av pappersarbete"
              width={80}
              height={80}
              className="h-20 w-20 shrink-0 rounded-xl object-cover"
            />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Stressad över flytten?
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Pappersarbete, adressändringar och deadlines. Vi tar hand om det åt dig.
              </p>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={100}>
          <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/5 px-4 py-1 text-sm font-medium text-primary backdrop-blur-sm">
            Kom igång
          </Badge>
        </ScrollReveal>

        <ScrollReveal delay={200}>
          <h2 className="mt-5 font-heading text-4xl font-bold tracking-tight text-foreground text-balance sm:text-5xl lg:text-6xl">
            Redo att flytta
            <span className="text-gradient"> utan krångel?</span>
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={300}>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Gör din flyttanmälan på 2 minuter – och få fördelar på köpet.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={400}>
          <div className="glass mx-auto mt-12 max-w-lg rounded-2xl p-8 shadow-xl">
            <div className="grid w-full grid-cols-2 gap-4">
              {highlights.map((h) => (
                <div key={h.text} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <h.icon className="h-4 w-4 shrink-0 text-primary" />
                  <span>{h.text}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <div className="absolute -inset-1 rounded-full bg-primary/20 animate-pulse-ring" />
                <Button
                  asChild
                  size="lg"
                  className="shimmer-btn relative w-full rounded-full text-base font-semibold shadow-xl shadow-primary/25 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/35 hover:-translate-y-1"
                >
                  <Link href="/adressandring">
                    Starta flyttanmälan med BankID
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full text-base bg-transparent backdrop-blur-sm"
              >
                <a href="#kontakt">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Support
                </a>
              </Button>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
