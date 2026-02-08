"use client"

import Image from "next/image"
import { Zap, Shield, Smartphone, Headphones } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { ScrollReveal } from "@/components/scroll-reveal"

const benefits = [
  {
    icon: Zap,
    title: "Snabbt",
    description: "Tydligt formulär med validering i realtid. Klart på under 5 minuter utan krångel.",
    tip: "Genomsnittlig tid: 2 min 43 sek",
  },
  {
    icon: Shield,
    title: "Tryggt",
    description: "Transparent pris och villkor innan betalning. Krypterad data hela vägen.",
    tip: "256-bit SSL-kryptering",
  },
  {
    icon: Smartphone,
    title: "Enkelt",
    description: "Mobilanpassat, inga krångliga steg. Fungerar lika bra på mobil som dator.",
    tip: "Responsiv design för alla enheter",
  },
  {
    icon: Headphones,
    title: "Support",
    description: "Hjälp om du fastnar via chatt eller FAQ. Vi finns här för dig alla dagar.",
    tip: "Svarstid under 2 timmar",
  },
]

export function BenefitsSection() {
  return (
    <section
      id="fordelar"
      className="relative overflow-hidden bg-section-alt py-24 lg:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="flex flex-col gap-16 lg:flex-row lg:items-center lg:gap-20">
          {/* Image */}
          <ScrollReveal variant="left" className="flex-1">
            <div className="relative">
              <div className="absolute -inset-6 rounded-3xl bg-primary/5 blur-2xl" />
              <div className="relative overflow-hidden rounded-2xl border border-border/50 shadow-xl">
                <Image
                  src="/images/family-moving.jpg"
                  alt="En familj som bär flyttkartonger in till sitt nya hem en solig sommardag"
                  width={600}
                  height={450}
                  className="h-auto w-full object-cover"
                />
              </div>

              {/* Floating badge */}
              <div className="absolute -right-3 -bottom-3 rounded-xl border border-border/50 bg-card/90 px-5 py-3 shadow-lg backdrop-blur-md sm:-right-6 sm:-bottom-6">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <Zap className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">Under 5 min</p>
                    <p className="text-xs text-muted-foreground">Genomsnittlig tid</p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* Content */}
          <div className="flex-1">
            <ScrollReveal variant="right">
              <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-4 py-1 text-sm font-medium text-primary">
                Fördelar
              </Badge>
              <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Därför väljer tusentals Flyttsmart
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                Vi gör adressändring så enkelt som möjligt, med fokus på trygghet och transparens.
              </p>
            </ScrollReveal>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <TooltipProvider>
                {benefits.map((benefit, i) => (
                  <ScrollReveal key={benefit.title} delay={i * 120}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Card className="group h-full cursor-default border-border transition-all duration-500 hover:border-primary/20 hover:shadow-md hover:-translate-y-1">
                          <CardContent className="flex gap-4 p-5">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-all duration-500 group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-110">
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
                          </CardContent>
                        </Card>
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
