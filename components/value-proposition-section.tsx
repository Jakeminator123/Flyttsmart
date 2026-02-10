"use client"

import { FileCheck, Zap, Gift, LayoutDashboard } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ScrollReveal } from "@/components/scroll-reveal"

const features = [
  {
    icon: FileCheck,
    title: "Automatisk flyttanmälan till Skatteverket",
    description: "Vi skickar din flyttanmälan direkt – korrekt och i tid.",
  },
  {
    icon: Zap,
    title: "Gratis el första månaden via vår partner",
    description: "Få el på nya adressen utan kostnad den första månaden.*",
  },
  {
    icon: Gift,
    title: "Förmånliga erbjudanden på bredband, hemförsäkring m.m.",
    description: "Relevanta erbjudanden anpassade efter din nya adress.",
  },
  {
    icon: LayoutDashboard,
    title: "Personlig överblick",
    description: "Inget du måste hålla reda på själv – allt samlat på ett ställe.",
  },
]

export function ValuePropositionSection() {
  return (
    <section className="relative overflow-hidden bg-background py-28 lg:py-36">
      <div className="section-divider absolute top-0 left-0 right-0" />

      {/* Animated background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="section-orb-1 -top-1/4 -left-1/4 h-125 w-125" />
        <div className="section-orb-accent -bottom-1/3 -right-1/4 h-125 w-125" />
      </div>

      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <ScrollReveal className="text-center">
          <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/5 px-4 py-1 text-sm font-medium text-primary">
            Det här ingår alltid
          </Badge>
          <h2 className="mt-5 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Flytt.io gör exakt det som flyttanmälan och adressändring ska göra
            <span className="text-gradient"> – fast enklare.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            När du flyttar ser vi till att rätt uppgifter hamnar hos Skatteverket och hjälper dig samtidigt
            att få smarta erbjudanden på din nya adress.
          </p>
        </ScrollReveal>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, i) => (
            <ScrollReveal key={feature.title} delay={i * 120}>
              <div className="gradient-border group flex h-full flex-col items-center rounded-2xl border border-border/50 bg-card p-8 text-center transition-all duration-500 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-2">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-all duration-500 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-xl group-hover:shadow-primary/25 group-hover:scale-110">
                  <feature.icon className="h-7 w-7" />
                </div>
                <h3 className="mb-2 font-heading text-base font-semibold text-card-foreground">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={400} className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            *Erbjudanden är frivilliga och utan köpkrav.
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
