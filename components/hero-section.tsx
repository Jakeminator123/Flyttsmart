"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ChevronDown, Lock, Shield, Headphones, Star, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollReveal } from "@/components/scroll-reveal"

export function HeroSection() {
  return (
    <section
      id="hero"
      className="relative min-h-screen overflow-hidden bg-linear-to-b from-hero-gradient-from to-hero-gradient-to"
    >
      {/* Subtle dot pattern */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03]">
        <div
          className="h-full w-full"
          style={{
            backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* Floating shapes */}
      <div className="pointer-events-none absolute top-24 left-8 h-64 w-64 rounded-full bg-primary/5 animate-float blur-3xl" />
      <div className="pointer-events-none absolute top-48 right-12 h-80 w-80 rounded-full bg-accent/30 animate-float-delayed blur-3xl" />
      <div className="pointer-events-none absolute bottom-32 left-1/3 h-48 w-48 rounded-full bg-primary/5 animate-float blur-3xl" />

      <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-12 px-4 pt-32 pb-16 lg:flex-row lg:gap-16 lg:px-8 lg:pt-40 lg:pb-24">
        {/* Text content */}
        <div className="flex flex-1 flex-col items-center text-center lg:items-start lg:text-left">
          <ScrollReveal>
            <Badge variant="outline" className="gap-2 rounded-full border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Snabb och säker adressändring
            </Badge>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <h1 className="mt-6 font-heading text-4xl font-bold leading-tight tracking-tight text-foreground text-balance sm:text-5xl lg:text-6xl xl:text-7xl">
              Flytta smart
              <span className="mt-2 block text-primary">
                med Flyttsmart
              </span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty lg:text-xl">
              Gör din adressändring online på bara några minuter. Trygg betalning,
              krypterad anslutning och support alla dagar i veckan.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={300}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative">
                <div className="absolute -inset-1 rounded-full bg-primary/20 animate-pulse-ring" />
                <Button
                  asChild
                  size="lg"
                  className="relative rounded-full px-8 text-base font-semibold shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
                >
                  <Link href="/adressandring">
                    Gör adressändring
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
              <div className="mt-8 flex flex-wrap items-center gap-4 text-sm text-muted-foreground lg:gap-6">
                {[
                  { icon: Shield, label: "Säker betalning", tip: "All data krypteras med 256-bit SSL" },
                  { icon: Lock, label: "Krypterad anslutning", tip: "HTTPS och bankgradig kryptering" },
                  { icon: Headphones, label: "Support alla dagar", tip: "Kontakta oss via chatt eller mejl" },
                ].map((item) => (
                  <Tooltip key={item.label}>
                    <TooltipTrigger asChild>
                      <div className="flex cursor-default items-center gap-2 rounded-full border border-transparent px-2 py-1 transition-colors hover:border-border hover:bg-card/50">
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

          {/* Social proof with Avatars */}
          <ScrollReveal delay={500}>
            <div className="mt-6 flex items-center gap-3 rounded-full border border-border/60 bg-card/60 px-4 py-2 backdrop-blur-sm">
              <div className="flex -space-x-2">
                {["AL", "MK", "SJ", "EL"].map((initials) => (
                  <Avatar key={initials} className="h-7 w-7 border-2 border-card">
                    <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-accent text-accent" />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                10 000+ nöjda flyttare
              </span>
            </div>
          </ScrollReveal>
        </div>

        {/* Hero image */}
        <ScrollReveal variant="scale" delay={200} className="flex-1">
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-primary/5 blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-border/50 shadow-2xl shadow-primary/10">
              <Image
                src="/images/hero-moving.jpg"
                alt="Ett par som just har flyttat in i en ny ljus lägenhet med flyttkartonger"
                width={640}
                height={480}
                className="h-auto w-full object-cover"
                priority
              />
              {/* Floating card overlay */}
              <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-border/50 bg-card/90 p-4 backdrop-blur-md sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-xs">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <CheckCircle className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">Trygg adressändring</p>
                    <p className="text-xs text-muted-foreground">Klar på under 5 minuter</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <ChevronDown className="h-6 w-6 text-muted-foreground/50" />
      </div>
    </section>
  )
}
