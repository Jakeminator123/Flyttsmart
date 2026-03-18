"use client"

import Link from "next/link"
import { ArrowRight, MessageCircle, Shield, Clock, Sparkles } from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
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
  visible: { transition: { staggerChildren: 0.1 } },
}

const highlights = [
  { icon: Clock, text: "Kort startsträcka" },
  { icon: Shield, text: "Trygg BankID-process" },
  { icon: Sparkles, text: "AI-checklista efter flytten" },
]

export function CtaSection() {
  return (
    <section
      id="gor-adressandring"
      className="relative overflow-hidden py-28 lg:py-36"
      style={{ position: "relative" }}
    >
      <div className="section-divider absolute top-0 left-0 right-0" />

      <div className="hero-mesh opacity-55" />
      <div className="hero-mesh-accent opacity-35" />
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-18" />
      <div className="pointer-events-none absolute inset-0 noise-overlay opacity-[0.02]" />

      <motion.div
        className="relative mx-auto max-w-4xl px-4 text-center lg:px-8"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={stagger}
      >
        <motion.div variants={fadeUp}>
          <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/5 px-4 py-1 text-sm font-medium text-primary backdrop-blur-sm">
            Klar att starta
          </Badge>
        </motion.div>

        <TextReveal
          as="h2"
          delay={0.2}
          lively
          className="mt-5 font-heading text-4xl font-bold tracking-tight text-foreground text-balance sm:text-5xl lg:text-6xl"
        >
          Gå vidare när du är redo.
        </TextReveal>

        <motion.p
          variants={fadeUp}
          className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground"
        >
          Börja enkelt nu. När flytten är registrerad får du fortsatt hjälp med
          checklista, påminnelser och relevanta erbjudanden i rätt ordning.
        </motion.p>

        <motion.div variants={fadeUp}>
          <div className="glass mx-auto mt-12 max-w-3xl rounded-3xl border border-foreground/8 p-8 shadow-2xl shadow-primary/8">
            <div className="grid w-full gap-4 sm:grid-cols-3">
              {highlights.map((h, i) => (
                <motion.div
                  key={h.text}
                  className="flex items-center gap-2.5 rounded-2xl border border-border/60 bg-background/72 px-4 py-3 text-sm text-muted-foreground"
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.08, duration: 0.5 }}
                >
                  <h.icon className="h-4 w-4 shrink-0 text-primary" />
                  <span>{h.text}</span>
                </motion.div>
              ))}
            </div>

            <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
              <Button
                asChild
                size="lg"
                className="shimmer-btn w-full rounded-full text-base font-semibold shadow-xl shadow-primary/18 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-primary/24 sm:w-auto sm:px-8"
              >
                <Link href="/adressandring">
                  Starta flyttanmälan
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full border-border/60 bg-background/80 text-base backdrop-blur-md"
              >
                <a href="#kontakt">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Support
                </a>
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}
