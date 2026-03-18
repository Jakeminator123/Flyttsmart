"use client"

import { Fingerprint, FileCheck, Sparkles, CheckCircle2 } from "lucide-react"
import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { TextReveal } from "@/components/text-reveal"

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
  visible: { transition: { staggerChildren: 0.15 } },
}

const steps = [
  {
    id: "input",
    icon: Sparkles,
    number: "01",
    title: "Börja med det du vet",
    description:
      "Starta med adress, ort eller flyttdatum och komplettera resten senare.",
    details: ["Kort start", "Tydlig guidning"],
  },
  {
    id: "bankid",
    icon: Fingerprint,
    number: "02",
    title: "Identifiera dig tryggt",
    description:
      "När det är dags verifierar du dig med BankID och går vidare med säkra uppgifter.",
    details: ["Mobilt BankID", "Trygg identifiering"],
  },
  {
    id: "flyttanmalan",
    icon: FileCheck,
    number: "03",
    title: "Vi skickar vidare till Skatteverket",
    description:
      "Flytt.io samlar ihop det viktigaste och leder dig vidare till ett tydligt klart-resultat.",
    details: ["Tydlig överlämning", "Mindre osäkerhet"],
  },
  {
    id: "klart",
    icon: CheckCircle2,
    number: "04",
    title: "Få hjälp efter flytten också",
    description:
      "När registreringen är klar tar checklista, påminnelser och smart uppföljning vid.",
    details: ["AI-checklista", "Påminnelser"],
  },
]

export function StepsSection() {
  return (
    <section
      id="hur-det-funkar"
      className="relative overflow-hidden bg-background py-20 lg:py-24"
      style={{ position: "relative" }}
    >
      <div className="section-divider absolute top-0 left-0 right-0" />
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-20" />
      <div className="pointer-events-none absolute inset-0 noise-overlay opacity-[0.02]" />

      <div className="relative mx-auto max-w-7xl px-4 lg:px-8">
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/5 px-4 py-1 text-sm font-medium text-primary">
              Så funkar det
            </Badge>
          </motion.div>
          <div className="mx-auto max-w-2xl">
            <TextReveal
              as="h2"
              delay={0.1}
              lively
              className="mt-5 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl"
            >
              Så fungerar Flytt.io
            </TextReveal>
            <motion.p
              className="mt-5 text-lg leading-relaxed text-muted-foreground"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4, duration: 0.8 }}
            >
              Ett tydligare flöde med färre frågetecken, mindre manuellt arbete
              och hjälp när du faktiskt behöver den.
            </motion.p>
          </div>
        </div>

        <motion.div
          className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
        >
          {steps.map((step) => (
            <motion.div key={step.id} variants={fadeUp}>
              <div className="gradient-border card-hover flex h-full flex-col rounded-2xl border border-border/50 bg-card/90 p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-heading text-4xl font-bold text-primary/12">
                    {step.number}
                  </span>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/10">
                    <step.icon className="h-4 w-4" />
                  </div>
                </div>
                <h3 className="mt-5 font-heading text-xl font-semibold text-card-foreground">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
                <div className="mt-5 space-y-2 border-t border-border/70 pt-4">
                  {step.details.map((detail) => (
                    <div key={detail} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                      <div className="h-2 w-2 rounded-full bg-accent" />
                      <span>{detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
