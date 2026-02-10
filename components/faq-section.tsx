"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { ScrollReveal } from "@/components/scroll-reveal"

const faqs = [
  {
    question: "Är Flytt.io samma sak som Skatteverket?",
    answer:
      "Nej. Flytt.io är en privat tjänst som hjälper dig att göra flyttanmälan till Skatteverket – enklare och med extra förmåner.",
    tag: "Grundläggande",
  },
  {
    question: "Kostar det verkligen inget?",
    answer:
      "Nej. Tjänsten är helt gratis för dig som användare.",
    tag: "Pris",
  },
  {
    question: "Måste jag byta el eller bredband?",
    answer:
      "Nej. Erbjudanden är helt frivilliga. Du väljer själv.",
    tag: "Erbjudanden",
  },
  {
    question: "Är det säkert?",
    answer:
      "Ja. Vi använder BankID och följer GDPR. Din data hanteras tryggt.",
    tag: "Säkerhet",
  },
]

export function FaqSection() {
  return (
    <section
      id="faq"
      className="relative overflow-hidden bg-section-alt py-28 lg:py-36"
    >
      <div className="section-divider absolute top-0 left-0 right-0" />

      {/* Animated background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="section-orb-accent -top-1/4 -right-1/4 h-125 w-125" />
        <div className="section-orb-2 -bottom-1/4 -left-1/3 h-125 w-125" />
      </div>

      <div className="mx-auto max-w-3xl px-4 lg:px-8">
        <ScrollReveal className="text-center">
          <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/5 px-4 py-1 text-sm font-medium text-primary">
            FAQ
          </Badge>
          <h2 className="mt-5 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Vanliga
            <span className="text-gradient"> frågor</span>
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            Här hittar du svar på de vanligaste frågorna om Flytt.io.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={200} className="mt-12">
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="gradient-border rounded-xl border border-border/50 bg-card px-6 transition-all duration-300 hover:shadow-md hover:shadow-primary/5 data-[state=open]:shadow-lg data-[state=open]:shadow-primary/10"
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
                  <div className="mb-4 h-px w-full bg-linear-to-r from-primary/15 via-border to-transparent" />
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
