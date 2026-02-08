"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollReveal } from "@/components/scroll-reveal"

const faqs = [
  {
    question: "Vad är adressändring och när ska jag göra den?",
    answer:
      "Adressändring innebär att du meddelar att du har fått en ny bostadsadress. Du bör göra en adressändring i samband med att du flyttar så att din post eftersänds till din nya adress. Vi rekommenderar att du gör det så snart du vet din nya adress, helst ett par veckor innan flytten.",
    tag: "Grundläggande",
  },
  {
    question: "Kan jag ändra startdatum i efterhand?",
    answer:
      "Ja, du kan ändra startdatumet för din adressändring om flytten senareläggs eller tidigareläggs. Kontakta vår kundservice så hjälper vi dig att uppdatera datumet. Tänk på att ändringen kan ta några dagar att träda i kraft.",
    tag: "Ändringar",
  },
  {
    question: "Gäller det hela familjen?",
    answer:
      "Du kan välja att inkludera familjemedlemmar i din adressändring. I beställningsflödet kan du enkelt lägga till medflyttare som bor på samma adress. Varje person som fyllt 18 år behöver dock ge sitt samtycke.",
    tag: "Familj",
  },
  {
    question: "Hur lång tid tar det?",
    answer:
      "Själva beställningen tar bara några minuter att genomföra online. Eftersändningen av din post startar normalt inom 3-5 arbetsdagar efter det startdatum du angett.",
    tag: "Tid",
  },
  {
    question: "Vad kostar det?",
    answer:
      "Priset visas tydligt innan du genomför betalningen. Det finns inga dolda avgifter. Ungdomar under 26 år och studenter kan få rabatterat pris.",
    tag: "Pris",
  },
  {
    question: "Hur hanteras mina uppgifter? (GDPR)",
    answer:
      "Vi tar din integritet på allvar. Dina personuppgifter hanteras i enlighet med GDPR och svenska dataskyddslagstiftningen. Vi delar aldrig dina uppgifter med tredje part utan ditt samtycke. Läs mer i vår integritetspolicy.",
    tag: "Säkerhet",
  },
]

export function FaqSection() {
  return (
    <section
      id="faq"
      className="relative bg-section-alt py-24 lg:py-32"
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-border to-transparent" />

      <div className="mx-auto max-w-3xl px-4 lg:px-8">
        <ScrollReveal className="text-center">
          <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-4 py-1 text-sm font-medium text-primary">
            FAQ
          </Badge>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Vanliga frågor
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Här hittar du svar på de vanligaste frågorna om adressändring.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={200} className="mt-12">
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="rounded-xl border border-border bg-card px-6 transition-all duration-200 hover:border-primary/20 data-[state=open]:border-primary/30 data-[state=open]:shadow-md"
              >
                <AccordionTrigger className="py-5 text-left font-heading font-semibold text-card-foreground hover:no-underline hover:text-primary transition-colors data-[state=open]:text-primary gap-4">
                  <span className="flex items-center gap-3">
                    {faq.question}
                    <Badge variant="secondary" className="hidden shrink-0 text-xs sm:inline-flex">
                      {faq.tag}
                    </Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-5">
                  <Separator className="mb-4" />
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {faq.answer}
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollReveal>
      </div>
    </section>
  )
}
