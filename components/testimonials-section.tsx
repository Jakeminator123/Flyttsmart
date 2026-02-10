"use client"

import { Star, Quote } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollReveal } from "@/components/scroll-reveal"

const testimonials = [
  {
    name: "Anna Lindqvist",
    initials: "AL",
    location: "Stockholm",
    rating: 5,
    text: "Smidigaste flytten jag gjort. Allt var klart på mindre än tre minuter och jag fick bekräftelsen direkt. Rekommenderar starkt!",
    date: "Jan 2026",
  },
  {
    name: "Marcus Karlsson",
    initials: "MK",
    location: "Göteborg",
    rating: 5,
    text: "Använde Flytt.io när vi flyttade hela familjen. Kunde lägga till fru och barn enkelt. Ingen post gick förlorad.",
    date: "Dec 2025",
  },
  {
    name: "Sara Johansson",
    initials: "SJ",
    location: "Malmö",
    rating: 5,
    text: "Mycket tryggare känsla att göra flyttanmälan via Flytt.io jämfört med andra tjänster. Tydliga villkor och helt gratis.",
    date: "Feb 2026",
  },
]

const stats = [
  { value: "10 000+", label: "Nöjda kunder" },
  { value: "4.9 / 5", label: "Medelbetyg" },
  { value: "<3 min", label: "Genomsnittlig tid" },
  { value: "99.8%", label: "Nöjdhetsgrad" },
]

export function TestimonialsSection() {
  return (
    <section id="omdomnen" className="relative overflow-hidden bg-section-alt py-28 lg:py-36">
      <div className="section-divider absolute top-0 left-0 right-0" />

      {/* Animated background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="section-orb-1 -top-1/4 left-1/4 h-125 w-125" />
        <div className="section-orb-accent -bottom-1/3 -right-1/4 h-150 w-150" />
      </div>

      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <ScrollReveal className="text-center">
          <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/5 px-4 py-1 text-sm font-medium text-primary">
            Omdömen
          </Badge>
          <h2 className="mt-5 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Vad våra kunder
            <span className="text-gradient"> säger</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Tusentals svenskar har redan gjort sin flyttanmälan med Flytt.io.
          </p>
        </ScrollReveal>

        {/* Stats bar */}
        <ScrollReveal delay={100}>
          <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((stat, i) => (
              <div key={stat.label} className="gradient-border group flex flex-col items-center rounded-2xl border border-border/50 bg-card p-6 text-center transition-all duration-500 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1">
                <span className="stat-glow font-heading text-3xl font-bold text-primary lg:text-4xl" style={{ animationDelay: `${i * 500}ms` }}>
                  {stat.value}
                </span>
                <span className="mt-2 text-sm text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </div>
        </ScrollReveal>

        <div className="my-14 section-divider" />

        {/* Testimonial cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <ScrollReveal key={t.name} delay={i * 120}>
              <div className="gradient-border group flex h-full flex-col rounded-2xl border border-border/50 bg-card p-7 transition-all duration-500 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-2">
                <Quote className="mb-5 h-10 w-10 text-primary/10 transition-colors duration-500 group-hover:text-primary/25" />

                <p className="flex-1 text-sm leading-relaxed text-muted-foreground italic">
                  &ldquo;{t.text}&rdquo;
                </p>

                <div className="mt-6 h-px w-full bg-linear-to-r from-border via-primary/15 to-transparent" />

                <div className="mt-5 flex items-center gap-3">
                  <Avatar className="h-11 w-11 border-2 border-primary/15">
                    <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
                      {t.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-card-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.location}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: t.rating }).map((_, j) => (
                        <Star key={j} className="h-3.5 w-3.5 fill-accent text-accent" />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">{t.date}</span>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
