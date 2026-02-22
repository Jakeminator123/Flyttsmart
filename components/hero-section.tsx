"use client"

import Link from "next/link"
import dynamic from "next/dynamic"
import { ArrowRight, ChevronDown, CheckCircle, Shield, Fingerprint } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { ScrollReveal } from "@/components/scroll-reveal"
import { HeroVisual } from "@/components/hero-visual"

const FloatingLines = dynamic(() => import("@/components/floating-lines"), {
  ssr: false,
})

const HERO_GRADIENT = ["#1B3BA2", "#2E5FC7", "#4A80E0", "#6BA3F5"]

export function HeroSection() {

  return (
    <section
      id="hero"
      className="relative min-h-screen overflow-hidden bg-linear-to-b from-hero-gradient-from to-background"
    >
      <div className="hero-mesh" />
      <div className="hero-mesh-accent" />

      <div className="pointer-events-none absolute inset-0 opacity-20">
        <FloatingLines
          linesGradient={HERO_GRADIENT}
          enabledWaves={["bottom", "middle", "top"]}
          lineCount={[4, 6, 3]}
          lineDistance={[8, 5, 10]}
          animationSpeed={0.6}
          interactive={false}
          parallax={false}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 dot-grid opacity-40" />

      <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-16 px-4 pt-36 pb-20 lg:flex-row lg:items-center lg:gap-16 lg:px-8 lg:pt-44 lg:pb-28 xl:gap-20">
        <div className="flex flex-1 flex-col items-center text-center lg:items-start lg:text-left">
          <ScrollReveal>
            <Badge variant="outline" className="gap-2 rounded-full border-primary/30 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Helt gratis flyttanmälan
            </Badge>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <h1 className="mt-8 font-heading text-5xl font-bold leading-[1.1] tracking-tight text-foreground text-balance sm:text-6xl lg:text-7xl xl:text-8xl">
              Flytta utan krångel.
              <span className="mt-2 block text-gradient">
                Klar på 2 minuter.
              </span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty lg:text-xl">
              Vi gör din flyttanmälan till Skatteverket automatiskt – och hjälper
              dig komma igång på nya adressen med el, bredband och försäkring.
              Helt gratis.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={300}>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative">
                <div className="absolute -inset-1 rounded-full bg-primary/20 animate-pulse-ring" />
                <Button
                  asChild
                  size="lg"
                  className="shimmer-btn relative rounded-full px-8 text-base font-semibold shadow-xl shadow-primary/25 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/35 hover:-translate-y-1"
                >
                  <Link href="/adressandring">
                    Starta din flytt med BankID
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <Button
                asChild
                variant="ghost"
                size="lg"
                className="rounded-full text-base text-muted-foreground hover:text-foreground"
              >
                <a href="#hur-det-funkar">
                  Så funkar det
                  <ChevronDown className="ml-1 h-4 w-4" />
                </a>
              </Button>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={400}>
            <TooltipProvider>
              <div className="mt-10 flex flex-wrap items-center gap-4 text-sm text-muted-foreground lg:gap-6">
                {[
                  { icon: CheckCircle, label: "Gratis", tip: "Tjänsten kostar inget för dig" },
                  { icon: Fingerprint, label: "Säker BankID-inloggning", tip: "Identifiera dig tryggt med Mobilt BankID" },
                  { icon: Shield, label: "GDPR-godkänd", tip: "Din data hanteras enligt dataskyddsförordningen" },
                ].map((item) => (
                  <Tooltip key={item.label}>
                    <TooltipTrigger asChild>
                      <div className="glass flex cursor-default items-center gap-2 rounded-full px-3.5 py-2 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
                        <item.icon className="h-4 w-4 text-primary" />
                        <span>{item.label}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>{item.tip}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
          </ScrollReveal>
        </div>

        <ScrollReveal variant="scale" delay={200} className="flex-1 w-full lg:max-w-md">
          <div className="relative">
            <div className="absolute -inset-8 rounded-4xl bg-primary/8 blur-3xl animate-float-slow" />
            <HeroVisual />
          </div>
        </ScrollReveal>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="flex h-10 w-6 items-start justify-center rounded-full border-2 border-muted-foreground/30 pt-2">
          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
        </div>
      </div>
    </section>
  )
}
