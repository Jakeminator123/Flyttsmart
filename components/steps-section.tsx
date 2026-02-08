"use client"

import { ClipboardList, Calendar, CreditCard, MailCheck, ArrowRight } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
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
      className="relative bg-background py-24 lg:py-32"
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-border to-transparent" />

      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <ScrollReveal className="text-center">
          <div className="mx-auto max-w-2xl">
            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-4 py-1 text-sm font-medium text-primary">
              Så funkar det
            </Badge>
            <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Fyra enkla steg till din nya adress
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Hela processen tar bara några minuter. Inget krångel, inga komplicerade steg.
            </p>
          </div>
        </ScrollReveal>

        {/* Desktop: Tabs layout */}
        <ScrollReveal delay={200} className="mt-16 hidden lg:block">
          <Tabs defaultValue="uppgifter" className="gap-0">
            <TabsList className="mx-auto mb-8 grid h-auto w-full max-w-2xl grid-cols-4 rounded-xl bg-muted p-1.5">
              {steps.map((step) => (
                <TabsTrigger
                  key={step.id}
                  value={step.id}
                  className="flex items-center gap-2 rounded-lg py-3 text-xs data-[state=active]:bg-card data-[state=active]:shadow-md sm:text-sm"
                >
                  <step.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{step.title.split(" ").slice(0, 2).join(" ")}</span>
                  <span className="sm:hidden">{step.number}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            {steps.map((step) => (
              <TabsContent key={step.id} value={step.id}>
                <div className="flex items-start gap-12 rounded-2xl border border-border bg-card p-8 lg:p-12">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-heading text-5xl font-bold text-primary/15">
                        {step.number}
                      </span>
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                        <step.icon className="h-6 w-6" />
                      </div>
                    </div>
                    <h3 className="mt-6 font-heading text-2xl font-bold text-card-foreground">
                      {step.title}
                    </h3>
                    <p className="mt-3 max-w-lg text-base leading-relaxed text-muted-foreground">
                      {step.description}
                    </p>
                    <Separator className="my-6" />
                    <div className="grid grid-cols-2 gap-3">
                      {step.details.map((detail) => (
                        <div key={detail} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
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
              <div className="group relative flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-all duration-500 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1.5">
                <div className="mb-4 flex items-center gap-3">
                  <span className="font-heading text-3xl font-bold text-primary/15 transition-colors duration-500 group-hover:text-primary/35">
                    {step.number}
                  </span>
                </div>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-500 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-lg group-hover:shadow-primary/25 group-hover:scale-110">
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
        <ScrollReveal delay={400} className="mt-12 text-center">
          <Button asChild size="lg" className="rounded-full px-8 gap-2">
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
