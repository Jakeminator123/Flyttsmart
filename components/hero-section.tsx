"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, Fingerprint, Shield, Sparkles } from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { HeroLanyard } from "@/components/hero-lanyard"
import { TextReveal } from "@/components/text-reveal"
import { parseStartIntent } from "@/lib/start-intent"

const fadeUp = {
  hidden: { opacity: 0, y: 24, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const },
  },
}

const trustItems = [
  { icon: Fingerprint, label: "BankID och trygg identifiering" },
  { icon: Shield, label: "Skatteverket och GDPR i samma flöde" },
  { icon: Sparkles, label: "AI-hjälp nu, checklista efter flytten" },
]

const quickExamples = [
  "Storgatan 12, Göteborg",
  "Vi flyttar 1 juni till Malmö",
  "Börja flyttanmälan",
]

export function HeroSection() {
  const [startInput, setStartInput] = useState("")

  const parsedStart = useMemo(() => parseStartIntent(startInput), [startInput])

  return (
    <section
      id="hero"
      className="relative overflow-x-hidden bg-linear-to-b from-hero-gradient-from via-background to-background"
      style={{ position: "relative" }}
    >
      <div className="hero-mesh opacity-80" />
      <div className="hero-mesh-accent opacity-50" />
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-[0.18]" />
      <div className="pointer-events-none absolute inset-0 noise-overlay opacity-[0.03]" />

      <div className="relative mx-auto max-w-7xl px-4 pt-28 pb-16 sm:pt-32 lg:px-8 lg:pt-40 lg:pb-24">
        <motion.div
          className="flex flex-col items-start"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
        >
          <motion.div variants={fadeUp}>
            <Badge variant="outline" className="rounded-full border-primary/15 bg-background/85 px-4 py-1.5 text-sm font-medium text-foreground shadow-sm">
              Flytt.io förenklar flytten innan, under och efter registreringen
            </Badge>
          </motion.div>

          <div className="mt-7 max-w-4xl">
            <TextReveal
              as="h1"
              splitBy="word"
              delay={0.18}
              staggerDelay={0.06}
              className="hero-title text-5xl font-bold leading-[1.02] tracking-tight text-foreground text-balance sm:text-6xl lg:text-7xl xl:text-[5.25rem]"
            >
              Flytta med mindre stress.
            </TextReveal>
            <TextReveal
              as="h1"
              splitBy="word"
              delay={0.4}
              staggerDelay={0.06}
              className="hero-title mt-2 text-5xl font-bold leading-[1.02] tracking-tight text-gradient-hero text-balance sm:text-6xl lg:text-7xl xl:text-[5.25rem]"
            >
              Klar snabbare med BankID.
            </TextReveal>
          </div>

          <motion.p
            variants={fadeUp}
            className="mt-7 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg lg:text-xl"
          >
            Skriv in det du vet, få hjälp att fylla i resten och gå vidare med
            en trygg flyttanmälan. När flytten är registrerad tar checklista,
            påminnelser och smarta erbjudanden vid.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mt-8 w-full max-w-2xl rounded-[28px] border border-border/70 bg-card/90 p-4 shadow-lg shadow-primary/10 backdrop-blur sm:p-5"
          >
            <form
              action="/adressandring"
              method="GET"
              className="flex flex-col gap-3.5"
            >
              <div className="flex flex-col gap-1.5">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Börja här
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Skriv adress, ort eller flyttdatum. Vi tar med det vi kan direkt.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  name="start"
                  value={startInput}
                  onChange={(e) => setStartInput(e.target.value)}
                  placeholder={'Skriv t.ex. "Storgatan 12, Göteborg" eller "Vi flyttar 1 juni till Malmö"'}
                  className="h-12 rounded-2xl border-border/70 bg-background/85 px-4 text-base"
                />

                <Button
                  type="submit"
                  size="lg"
                  disabled={!startInput.trim()}
                  className="shimmer-btn h-12 rounded-2xl px-5 text-base font-semibold shadow-lg shadow-primary/15 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/20 sm:px-6"
                >
                  Fortsätt
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {quickExamples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setStartInput(example)}
                    className="rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                  >
                    {example}
                  </button>
                ))}
              </div>

              <div className="min-h-5 text-xs leading-relaxed text-muted-foreground">
                {parsedStart.summary.length > 0
                  ? `Vi kan redan ta med ${parsedStart.summary.join(", ")}.`
                  : "Du kan börja enkelt här och komplettera resten steg för steg."}
              </div>
            </form>
          </motion.div>

          <motion.div variants={fadeUp} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              size="lg"
              className="shimmer-btn rounded-full px-8 text-base font-semibold shadow-xl shadow-primary/15 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-primary/20"
            >
              <Link href="/adressandring">
                Starta din flytt
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-full border-border/70 bg-background/80 px-8 text-base"
            >
              <a href="#hur-det-funkar">Se hur det fungerar</a>
            </Button>
          </motion.div>

          <motion.div variants={fadeUp} className="mt-7 grid gap-3 sm:mt-8 sm:grid-cols-3">
            {trustItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/90 px-4 py-3 text-sm text-foreground shadow-sm"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <item.icon className="h-4 w-4" />
                </div>
                <span className="leading-snug">{item.label}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          className="relative mt-14 w-full overflow-visible sm:mt-16"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.18 }}
        >
          <div className="relative overflow-visible">
            <div className="absolute inset-x-8 -top-10 bottom-8 rounded-[3rem] bg-ring/10 blur-3xl sm:inset-x-12 lg:inset-x-20" />
            <HeroLanyard />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
