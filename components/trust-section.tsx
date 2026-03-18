"use client"

import { useRef } from "react"
import { Lock, FileCheck, Fingerprint } from "lucide-react"
import { motion, useScroll, useTransform } from "framer-motion"
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

const trustSignals = [
  {
    icon: Fingerprint,
    title: "BankID när det behövs",
    description: "Identifiering sker först när det är dags att bekräfta uppgifter och gå vidare.",
  },
  {
    icon: Lock,
    title: "Krypterad hantering",
    description: "Personuppgifter hanteras varsamt och skyddas med modern teknisk säkerhet.",
  },
  {
    icon: FileCheck,
    title: "Tydliga villkor",
    description: "Tjänsten är gratis att använda och eventuella erbjudanden är alltid frivilliga.",
  },
]

const trustPillars = [
  {
    title: "Gratis att använda",
    description: "Du kan komma igång utan avgifter eller bindning.",
  },
  {
    title: "Tydlig process",
    description: "Du ser vad som är klart och vad som återstår i nästa steg.",
  },
  {
    title: "Privat tjänst",
    description: "Flytt.io guidar dig vidare på ett lugnare och tydligare sätt.",
  },
]

export function TrustSection() {
  const sectionRef = useRef<HTMLElement>(null)

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  })

  const orbY = useTransform(scrollYProgress, [0, 1], ["10%", "-10%"])

  return (
    <section
      ref={sectionRef}
      id="sakerhet"
      className="relative overflow-hidden bg-background py-20 lg:py-24"
      style={{ position: "relative" }}
    >
      <div className="section-divider absolute top-0 left-0 right-0" />

      <motion.div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" style={{ y: orbY }}>
        <div className="section-orb-2 -top-1/3 -left-1/4 h-150 w-150" />
        <div className="section-orb-1 -bottom-1/3 -right-1/3 h-125 w-125" />
      </motion.div>
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-[0.05]" />
      <div className="pointer-events-none absolute inset-0 noise-overlay opacity-[0.03]" />

      <div className="relative mx-auto max-w-7xl px-4 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/5 px-4 py-1 text-sm font-medium text-primary">
              Trygg hantering
            </Badge>
          </motion.div>
          <TextReveal
            as="h2"
            delay={0.1}
            lively
            className="mt-5 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl"
          >
            Tydligt, tryggt och utan överdrifter
          </TextReveal>
          <motion.p
            className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.8 }}
          >
            Flytt.io fokuserar på det viktiga: tydlig identifiering, trygg
            hantering av uppgifter och villkor som är enkla att förstå.
          </motion.p>
        </div>

        {/* Trust row */}
        <motion.div
          className="mx-auto mt-10 grid max-w-5xl gap-3 md:grid-cols-3"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
        >
          {trustPillars.map((pillar) => (
            <motion.div key={pillar.title} variants={fadeUp}>
              <div className="rounded-2xl border border-border/60 bg-card/78 px-5 py-5 text-left shadow-sm">
                <p className="text-sm font-semibold text-foreground">{pillar.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {pillar.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Trust cards */}
        <motion.div
          className="mt-10 grid gap-4 md:grid-cols-3"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
        >
          {trustSignals.map((signal) => (
            <motion.div key={signal.title} variants={fadeUp}>
              <div className="gradient-border card-hover group flex h-full flex-col items-center rounded-2xl border border-border/50 bg-card/90 p-6 text-center backdrop-blur-sm">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-all duration-500 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-lg group-hover:shadow-primary/20">
                  <signal.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 font-heading text-lg font-semibold text-card-foreground">
                  {signal.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {signal.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
