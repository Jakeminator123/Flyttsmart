"use client"

import { ClipboardList, Calendar, CreditCard, MailCheck, ArrowRight } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ScrollReveal } from "@/components/scroll-reveal"

const steps = [
  {
    id: "uppgifter",
    icon: ClipboardList,
    number: "01",
    title: "Fyll i dina uppgifter",
    description:
      "Ange person- och flyttuppgifter i ett tydligt formulär med realtidsvalidering. Systemet hjälper dig att fylla i allt korrekt redan från start.",
    details: ["Personnummer", "Nuvarande adress", "Ny adress", "Kontaktuppgifter"],
  },
  {
    id: "datum",
    icon: Calendar,
    number: "02",
    title: "Välj startdatum",
    description:
      "Välj när eftersändningen ska börja och lägg till eventuella familjemedlemmar som flyttar med dig.",
    details: ["Flexibelt startdatum", "Lägg till medflyttare", "Eftersändningsperiod", "Familjepaket"],
  },
  {
    id: "betala",
    icon: CreditCard,
    number: "03",
    title: "Bekräfta och betala",
    description:
      "Granska dina uppgifter och betala säkert. Transparenta priser utan dolda avgifter visas tydligt före betalning.",
    details: ["Visa & Mastercard", "Swish", "Inga dolda avgifter", "SSL-krypterat"],
  },
  {
    id: "klart",
    icon: MailCheck,
    number: "04",
    title: "Bekräftelse på mejl",
    description:
      "Du får en bekräftelse direkt på mejl. Din adressändring är klar och eftersändningen startar på valt datum.",
    details: ["Direkt bekräftelse", "Spårningslänk", "Ändringsmöjlighet", "Kvitto på mejl"],
  },
]

export function StepsSection() {
  return (
    <section
      id="hur-det-funkar"
      className="relative bg-background py-28 lg:py-36"
    >
      <div className="section-divider absolute top-0 left-0 right-0" />

      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <ScrollReveal className="text-center">
          <div className="mx-auto max-w-2xl">
            <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/5 px-4 py-1 text-sm font-medium text-primary">
              Så funkar det
            </Badge>
            <h2 className="mt-5 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Fyra enkla steg till din
              <span className="text-gradient"> nya adress</span>
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
              Hela processen tar bara några minuter. Inget krångel, inga komplicerade steg.
            </p>
          </div>
        </ScrollReveal>

        {/* Desktop: Tabs layout */}
        <ScrollReveal delay={200} className="mt-16 hidden lg:block">
          <Tabs defaultValue="uppgifter" className="gap-0">
            <TabsList className="mx-auto mb-10 grid h-auto w-full max-w-2xl grid-cols-4 rounded-2xl bg-muted/80 p-2 backdrop-blur-sm">
              {steps.map((step) => (
                <TabsTrigger
                  key={step.id}
                  value={step.id}
                  className="flex items-center gap-2 rounded-xl py-3.5 text-xs data-[state=active]:bg-card data-[state=active]:shadow-lg data-[state=active]:shadow-primary/10 sm:text-sm transition-all duration-300"
                >
                  <step.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{step.title.split(" ").slice(0, 2).join(" ")}</span>
                  <span className="sm:hidden">{step.number}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            {steps.map((step) => (
              <TabsContent key={step.id} value={step.id}>
                <div className="gradient-border flex items-start gap-12 rounded-2xl border border-border/50 bg-card p-10 lg:p-14">
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <span className="font-heading text-6xl font-bold text-primary/10">
                        {step.number}
                      </span>
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xl shadow-primary/25 glow">
                        <step.icon className="h-7 w-7" />
                      </div>
                    </div>
                    <h3 className="mt-8 font-heading text-2xl font-bold text-card-foreground">
                      {step.title}
                    </h3>
                    <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
                      {step.description}
                    </p>
                    <div className="mt-8 h-px w-full bg-linear-to-r from-border via-primary/20 to-transparent" />
                    <div className="mt-8 grid grid-cols-2 gap-4">
                      {step.details.map((detail) => (
                        <div key={detail} className="flex items-center gap-3 text-sm text-muted-foreground">
                          <div className="h-2 w-2 rounded-full bg-primary/60 shadow-sm shadow-primary/40" />
                          {detail}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </ScrollReveal>

        {/* Mobile: Card grid */}
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:hidden">
          {steps.map((step, i) => (
            <ScrollReveal key={step.number} delay={i * 120}>
              <div className="gradient-border group relative flex h-full flex-col rounded-2xl border border-border/50 bg-card p-6 transition-all duration-500 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-2">
                <div className="mb-4 flex items-center gap-3">
                  <span className="font-heading text-4xl font-bold text-primary/10 transition-colors duration-500 group-hover:text-primary/25">
                    {step.number}
                  </span>
                </div>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-500 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-xl group-hover:shadow-primary/25 group-hover:scale-110">
                  <step.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 font-heading text-lg font-semibold text-card-foreground">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        {/* CTA under steps */}
        <ScrollReveal delay={400} className="mt-14 text-center">
          <Button asChild size="lg" className="shimmer-btn rounded-full px-8 gap-2 shadow-lg shadow-primary/20 transition-all duration-300 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5">
            <Link href="/adressandring">
              Starta din adressändring
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </ScrollReveal>
      </div>
    </section>
  )
}
