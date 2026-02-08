"use client"

import { Star, Quote } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
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
    text: "Använde Flyttsmart när vi flyttade hela familjen. Kunde lägga till fru och barn enkelt. Ingen post gick förlorad.",
    date: "Dec 2025",
  },
  {
    name: "Sara Johansson",
    initials: "SJ",
    location: "Malmö",
    rating: 5,
    text: "Mycket tryggare känsla att göra adressändringen via Flyttsmart jämfört med andra tjänster. Tydliga villkor och inga dolda avgifter.",
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
    <section id="omdomnen" className="relative bg-section-alt py-24 lg:py-32">
      <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-border to-transparent" />

      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <ScrollReveal className="text-center">
          <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-4 py-1 text-sm font-medium text-primary">
            Omdömen
          </Badge>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Vad våra kunder säger
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Tusentals svenskar har redan gjort sin adressändring med Flyttsmart.
          </p>
        </ScrollReveal>

        {/* Stats bar */}
        <ScrollReveal delay={100}>
          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center rounded-xl border border-border bg-card p-5 text-center">
                <span className="font-heading text-2xl font-bold text-primary lg:text-3xl">
                  {stat.value}
                </span>
                <span className="mt-1 text-sm text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </div>
        </ScrollReveal>

        <Separator className="my-12" />

        {/* Testimonial cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <ScrollReveal key={t.name} delay={i * 120}>
              <Card className="group h-full border-border bg-card transition-all duration-500 hover:border-primary/20 hover:shadow-lg hover:-translate-y-1.5">
                <CardContent className="flex h-full flex-col p-6">
                  <Quote className="mb-4 h-8 w-8 text-primary/15 transition-colors duration-500 group-hover:text-primary/30" />

                  <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                    {`"${t.text}"`}
                  </p>

                  <Separator className="my-4" />

                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border-2 border-primary/10">
                      <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
                        {t.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-card-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.location}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: t.rating }).map((_, j) => (
                          <Star key={j} className="h-3 w-3 fill-accent text-accent" />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">{t.date}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
