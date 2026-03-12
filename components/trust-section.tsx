"use client"

import { useRef } from "react"
import { Lock, FileCheck, Fingerprint } from "lucide-react"
import { motion, useScroll, useTransform } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { TextReveal } from "@/components/text-reveal"
import { AnimatedCounter } from "@/components/animated-counter"

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
    title: "Säker inloggning med BankID",
    description: "Identifiera dig tryggt med Mobilt BankID – samma säkerhet som din bank.",
  },
  {
    icon: Lock,
    title: "Krypterad data",
    description: "Dina personuppgifter skyddas med modern kryptering och hanteras enligt GDPR.",
  },
  {
    icon: FileCheck,
    title: "Tydliga villkor",
    description: "100% gratis. Inga dolda kostnader. Alla erbjudanden är frivilliga.",
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
              Tryggt val
            </Badge>
          </motion.div>
          <TextReveal
            as="h2"
            delay={0.1}
            lively
            className="mt-5 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl"
          >
            Säkerheten du förtjänar
          </TextReveal>
          <motion.p
            className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.8 }}
          >
            Används av tusentals flyttare varje månad. Dina uppgifter hanteras tryggt och säkert.
          </motion.p>
        </div>

        {/* Stats row */}
        <motion.div
          className="mx-auto mt-10 flex max-w-2xl items-center justify-center gap-6 sm:gap-12"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={fadeUp}
        >
          <div className="text-center">
            <AnimatedCounter target={12000} suffix="+" className="font-heading text-3xl font-bold text-primary lg:text-4xl" />
            <p className="mt-1 text-sm text-muted-foreground">Flyttanmälningar</p>
          </div>
          <div className="hidden h-12 w-px bg-border sm:block" />
          <div className="text-center">
            <AnimatedCounter target={99} suffix="%" className="font-heading text-3xl font-bold text-primary lg:text-4xl" />
            <p className="mt-1 text-sm text-muted-foreground">Nöjdhet</p>
          </div>
          <div className="hidden h-12 w-px bg-border sm:block" />
          <div className="text-center">
            <AnimatedCounter target={2} suffix=" min" className="font-heading text-3xl font-bold text-primary lg:text-4xl" duration={1} />
            <p className="mt-1 text-sm text-muted-foreground">Genomsnitt</p>
          </div>
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
