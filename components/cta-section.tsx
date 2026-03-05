"use client"

import { useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import dynamic from "next/dynamic"
import { ArrowRight, MessageCircle, Shield, Clock, Lock, CheckCircle } from "lucide-react"
import { motion, useScroll, useTransform } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TextReveal } from "@/components/text-reveal"
import { MagneticButton } from "@/components/magnetic-button"

const FloatingLines = dynamic(() => import("@/components/floating-lines"), {
  ssr: false,
})

const CTA_GRADIENT = ["#1B3BA2", "#4A80E0", "#D4A843"]

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
  { icon: Clock, text: "Klar på 2 minuter" },
  { icon: Shield, text: "100% gratis" },
  { icon: Lock, text: "BankID-inloggning" },
  { icon: CheckCircle, text: "GDPR-godkänd" },
]

export function CtaSection() {
  const sectionRef = useRef<HTMLElement>(null)

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  })

  const linesY = useTransform(scrollYProgress, [0, 1], ["8%", "-8%"])

  return (
    <section
      ref={sectionRef}
      id="gor-adressandring"
      className="relative overflow-hidden py-28 lg:py-36"
      style={{ position: "relative" }}
    >
      <div className="section-divider absolute top-0 left-0 right-0" />

      <div className="hero-mesh opacity-70" />
      <div className="hero-mesh-accent opacity-45" />
      <motion.div
        className="pointer-events-none absolute inset-0 -top-[10%] -bottom-[10%] opacity-[0.16]"
        style={{ y: linesY }}
      >
        <FloatingLines
          linesGradient={CTA_GRADIENT}
          enabledWaves={["bottom", "middle"]}
          lineCount={[3, 4]}
          lineDistance={[10, 6]}
          animationSpeed={0.4}
          interactive={false}
          parallax={true}
          parallaxStrength={0.2}
        />
      </motion.div>
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-30" />
      <div className="pointer-events-none absolute inset-0 noise-overlay opacity-[0.02]" />

      <motion.div
        className="relative mx-auto max-w-4xl px-4 text-center lg:px-8"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={stagger}
      >
        {/* "Before" contrast card */}
        <motion.div variants={fadeUp}>
          <div className="glass card-3d card-hover mx-auto mb-10 flex max-w-md items-center gap-5 rounded-2xl border border-border/40 p-4 text-left shadow-lg">
            <Image
              src="/media/images/ledsen_man.webp"
              alt="En stressad man omgiven av pappersarbete"
              width={80}
              height={80}
              className="person-image-drift-alt h-20 w-20 shrink-0 rounded-xl object-cover"
            />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Stressad över flytten?
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Pappersarbete, adressändringar och deadlines. Vi tar hand om det åt dig.
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/5 px-4 py-1 text-sm font-medium text-primary backdrop-blur-sm">
            Kom igång
          </Badge>
        </motion.div>

        <TextReveal
          as="h2"
          delay={0.2}
          lively
          className="mt-5 font-heading text-4xl font-bold tracking-tight text-foreground text-balance sm:text-5xl lg:text-6xl"
        >
          Redo att flytta utan krångel?
        </TextReveal>

        <motion.p
          variants={fadeUp}
          className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground"
        >
          Gör din flyttanmälan på 2 minuter – och få fördelar på köpet.
        </motion.p>

        <motion.div variants={fadeUp}>
          <div className="glass card-3d mx-auto mt-12 max-w-lg rounded-2xl border border-foreground/10 p-8 shadow-2xl shadow-primary/10">
            <div className="grid w-full grid-cols-2 gap-4">
              {highlights.map((h, i) => (
                <motion.div
                  key={h.text}
                  className="flex items-center gap-2.5 text-sm text-muted-foreground"
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

            <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row">
              <MagneticButton className="relative flex-1" strength={0.1}>
                <div className="absolute -inset-1 rounded-full bg-primary/20 animate-pulse-ring" />
                <Button
                  asChild
                  size="lg"
                  className="shimmer-btn relative w-full rounded-full text-base font-semibold shadow-xl shadow-primary/25 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/35 hover:-translate-y-1"
                >
                  <Link href="/adressandring">
                    Starta flyttanmälan med BankID
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </MagneticButton>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full border-border/60 bg-background/70 text-base backdrop-blur-md"
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
