"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { Zap, Shield, Heart, Lock, Play } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { ScrollReveal } from "@/components/scroll-reveal"

const benefits = [
  {
    icon: Zap,
    title: "Flyttanmälan – fast smartare",
    description: "Myndighetsdelen ska vara enkel. Det gör vi automatiskt.",
    tip: "Automatisk flyttanmälan till Skatteverket",
  },
  {
    icon: Heart,
    title: "Du väljer själv",
    description: "Alla erbjudanden är frivilliga. Vi visar bara sådant som faktiskt passar din nya adress.",
    tip: "Inga krav, inga köptvång",
  },
  {
    icon: Shield,
    title: "100 % gratis",
    description: "Tjänsten kostar inget för dig. Punkt.",
    tip: "Helt gratis – inga dolda avgifter",
  },
  {
    icon: Lock,
    title: "Säkerhet i fokus",
    description: "BankID, kryptering och full transparens kring din data.",
    tip: "BankID + GDPR-skydd",
  },
]

export function BenefitsSection() {
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
      id="fordelar"
      className="relative overflow-hidden bg-section-alt py-28 lg:py-36"
    >
      <div className="section-divider absolute top-0 left-0 right-0" />

      {/* Animated background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="section-orb-accent -top-1/4 -left-1/4 h-125 w-125" />
        <div className="section-orb-1 -bottom-1/4 -right-1/4 h-125 w-125" />
        <div className="absolute inset-0 dot-grid opacity-[0.06]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="flex flex-col gap-16 lg:flex-row lg:items-center lg:gap-20">
          {/* Video */}
          <ScrollReveal variant="left" className="flex-1">
            <div className="relative">
              <div className="absolute -inset-8 rounded-3xl bg-primary/5 blur-3xl animate-float-slow" />
              <div
                className="gradient-border group relative cursor-pointer overflow-hidden rounded-2xl shadow-2xl shadow-primary/10 transition-all duration-500 hover:shadow-3xl hover:shadow-primary/20"
                onClick={handlePlayToggle}
              >
                <div className="relative aspect-video w-full overflow-hidden rounded-2xl">
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

                  <Image
                    src="/images/glad_familj.webp"
                    alt="En glad familj omgiven av flyttkartonger i sitt nya hem"
                    width={600}
                    height={450}
                    className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
                      isPlaying ? "opacity-0" : "opacity-100"
                    }`}
                  />

                  {/* Gradient overlay */}
                  <div
                    className={`pointer-events-none absolute inset-0 bg-linear-to-t from-black/50 via-black/10 to-transparent transition-opacity duration-300 ${
                      isPlaying ? "opacity-0" : "opacity-100"
                    }`}
                  />

                  {/* Play / Pause button */}
                  <div
                    className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                      isPlaying ? "opacity-0 group-hover:opacity-100" : "opacity-100"
                    }`}
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-primary shadow-2xl backdrop-blur-sm transition-all duration-300 group-hover:scale-110 glow">
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
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -right-3 -bottom-3 glass rounded-xl px-5 py-3.5 shadow-xl sm:-right-6 sm:-bottom-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                    <Zap className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">100% gratis</p>
                    <p className="text-xs text-muted-foreground">Inga dolda avgifter</p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* Content */}
          <div className="flex-1">
            <ScrollReveal variant="right">
              <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/5 px-4 py-1 text-sm font-medium text-primary">
                Fördelar
              </Badge>
              <h2 className="mt-5 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Varför
                <span className="text-gradient"> Flytt.io?</span>
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
                Flyttanmälan – fast bra. Flytten på autopilot.
              </p>
            </ScrollReveal>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <TooltipProvider>
                {benefits.map((benefit, i) => (
                  <ScrollReveal key={benefit.title} delay={i * 120}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="gradient-border group h-full cursor-default rounded-xl border border-border/50 bg-card p-5 transition-all duration-500 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1.5">
                          <div className="flex gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-500 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-lg group-hover:shadow-primary/25 group-hover:scale-110">
                              <benefit.icon className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="font-heading font-semibold text-card-foreground">
                                {benefit.title}
                              </h3>
                              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                                {benefit.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>{benefit.tip}</TooltipContent>
                    </Tooltip>
                  </ScrollReveal>
                ))}
              </TooltipProvider>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
