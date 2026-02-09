"use client"

import Link from "next/link"
import { ArrowRight, ChevronDown, Lock, Shield, Headphones, Star, CheckCircle, Play } from "lucide-react"
import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollReveal } from "@/components/scroll-reveal"

export function HeroSection() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const handlePlayToggle = () => {
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      videoRef.current.play()
      setIsPlaying(true)
    } else {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }

  return (
    <section
      id="hero"
      className="relative min-h-screen overflow-hidden bg-linear-to-b from-hero-gradient-from to-hero-gradient-to"
    >
      <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-12 px-4 pt-32 pb-16 lg:flex-row lg:items-center lg:gap-12 lg:px-8 lg:pt-40 lg:pb-24 xl:gap-16">
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

        {/* Hero video */}
        <ScrollReveal variant="scale" delay={200} className="flex-1 w-full lg:max-w-[560px]">
          <div className="relative">
            {/* Soft glow behind video */}
            <div className="absolute -inset-6 rounded-4xl bg-primary/5 blur-3xl" />

            <div
              className="group relative cursor-pointer overflow-hidden rounded-2xl border border-border/50 bg-muted shadow-2xl shadow-primary/10"
              onClick={handlePlayToggle}
            >
              {/* Fixed aspect ratio wrapper */}
              <div className="relative aspect-video w-full">
                <video
                  ref={videoRef}
                  src="/videos/reklam.mp4"
                  playsInline
                  preload="metadata"
                  onEnded={() => setIsPlaying(false)}
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
                    isPlaying ? "opacity-100" : "opacity-0"
                  }`}
                />

                {/* Poster image (shown when not playing) */}
                <img
                  src="/images/hero-moving.jpg"
                  alt="Par i sitt nya hem"
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
                    isPlaying ? "opacity-0" : "opacity-100"
                  }`}
                />

                {/* Subtle gradient overlay for text readability */}
                <div
                  className={`pointer-events-none absolute inset-0 bg-linear-to-t from-black/40 via-black/10 to-transparent transition-opacity duration-300 ${
                    isPlaying ? "opacity-0" : "opacity-100"
                  }`}
                />

                {/* Play / Pause button overlay */}
                <div
                  className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                    isPlaying ? "opacity-0 group-hover:opacity-100" : "opacity-100"
                  }`}
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-primary shadow-xl backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
                    {isPlaying ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                      </svg>
                    ) : (
                      <Play className="h-7 w-7 ml-1" fill="currentColor" />
                    )}
                  </div>
                </div>

                {/* Floating info card in bottom-right corner */}
                <div
                  className={`absolute bottom-4 left-4 right-4 rounded-xl border border-white/20 bg-white/90 p-3 backdrop-blur-md transition-all duration-500 sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-[220px] ${
                    isPlaying ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <CheckCircle className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground leading-tight">Trygg adressändring</p>
                      <p className="text-xs text-muted-foreground">Klar på under 5 min</p>
                    </div>
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
