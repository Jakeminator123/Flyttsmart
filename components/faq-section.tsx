"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { motion } from "framer-motion"
import { TextReveal } from "@/components/text-reveal"
import { createFaqStructuredData } from "@/lib/structured-data"

const fadeUp = {
  hidden: { opacity: 0, y: 30, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
  },
}

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

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

const faqStructuredData = createFaqStructuredData(
  faqs.map((faq) => ({
    question: faq.question,
    answer: faq.answer,
  })),
)

export function FaqSection() {
  return (
    <section
      id="faq"
      className="relative overflow-hidden bg-section-alt py-28 lg:py-36"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />
      <div className="section-divider absolute top-0 left-0 right-0" />

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="section-orb-accent -top-1/4 -right-1/4 h-125 w-125" />
        <div className="section-orb-2 -bottom-1/4 -left-1/3 h-125 w-125" />
      </div>
      <div className="pointer-events-none absolute inset-0 noise-overlay opacity-[0.02]" />

      <div className="relative mx-auto max-w-3xl px-4 lg:px-8">
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/5 px-4 py-1 text-sm font-medium text-primary">
              FAQ
            </Badge>
          </motion.div>
          <TextReveal
            as="h2"
            delay={0.1}
            lively
            className="mt-5 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl"
          >
            Vanliga frågor
          </TextReveal>
          <motion.p
            className="mt-5 text-lg leading-relaxed text-muted-foreground"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.8 }}
          >
            Här hittar du svar på de vanligaste frågorna om Flytt.io.
          </motion.p>
        </div>

        <motion.div
          className="mt-12"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          variants={stagger}
        >
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <motion.div key={i} variants={fadeUp}>
                <AccordionItem
                  value={`item-${i}`}
                  className="gradient-border moving-box rounded-xl border border-border/50 bg-card/92 px-6 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/8 data-[state=open]:shadow-xl data-[state=open]:shadow-primary/12"
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
              </motion.div>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  )
}
