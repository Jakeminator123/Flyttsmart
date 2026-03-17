"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, Fingerprint, Shield, Sparkles } from "lucide-react"
import { motion } from "framer-motion"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmbeddedLandingAida } from "@/components/embedded-landing-aida"
import { TextReveal } from "@/components/text-reveal"
import { cn } from "@/lib/utils"

const SHOW_LANYARD = true

const HeroLanyard = dynamic(
  () => import("@/components/hero-lanyard").then((m) => m.HeroLanyard),
  { ssr: false },
)

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

function MovingBox({
  children,
  className,
  intensity = 12,
  delay = 0.8,
}: {
  children: React.ReactNode
  className?: string
  intensity?: number
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const raf = useRef(0)
  const canTrack = useRef(false)
  const [landing, setLanding] = useState(true)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      canTrack.current = true
      setLanding(false)
      return
    }

    const done = () => {
      canTrack.current = true
      setLanding(false)
    }
    el.addEventListener("animationend", done, { once: true })
    const fallback = setTimeout(done, (delay + 2.5) * 1000)
    return () => {
      el.removeEventListener("animationend", done)
      clearTimeout(fallback)
    }
  }, [delay])

  const onMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!canTrack.current) return
      const el = ref.current
      if (!el) return
      cancelAnimationFrame(raf.current)
      raf.current = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect()
        const nx = (e.clientX - r.left) / r.width - 0.5
        const ny = (e.clientY - r.top) / r.height - 0.5
        el.style.transform =
          `perspective(800px) rotateX(${ny * -intensity}deg) rotateY(${nx * intensity}deg) translateY(-4px)`
      })
    },
    [intensity],
  )

  const onLeave = useCallback(() => {
    if (!canTrack.current) return
    cancelAnimationFrame(raf.current)
    if (ref.current) ref.current.style.transform = ""
  }, [])

  return (
    <div
      ref={ref}
      className={cn("moving-box", landing && "moving-box-landing", className)}
      style={{ "--settle-delay": `${delay}s` } as React.CSSProperties}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <div className="moving-box-edge moving-box-edge-top" aria-hidden="true" />
      <div className="moving-box-edge moving-box-edge-right" aria-hidden="true" />
      <div className="moving-box-edge moving-box-edge-bottom" aria-hidden="true" />
      <div className="moving-box-edge moving-box-edge-left" aria-hidden="true" />
      {children}
    </div>
  )
}

export function HeroSection() {
  return (
    <section
      id="hero"
      className="relative overflow-visible bg-linear-to-b from-hero-gradient-from via-background to-background"
    >
      <div className="relative mx-auto w-full px-4 pt-24 pb-16 sm:pt-28 lg:min-h-[85vh] lg:px-8 lg:pt-28 lg:pb-20 xl:px-12 2xl:px-20">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-6 xl:gap-0">
          <motion.div
            className="relative z-20 flex w-full min-w-0 flex-col items-start lg:max-w-2xl xl:max-w-3xl 2xl:max-w-4xl"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
          >
            <motion.div variants={fadeUp}>
              <Badge
                variant="outline"
                className="rounded-full border-primary/15 bg-background/85 px-4 py-1.5 text-sm font-medium text-foreground shadow-sm"
              >
                Flytt.io förenklar flytten innan, under och efter registreringen
              </Badge>
            </motion.div>

            <div className="mt-7 max-w-4xl">
              <div className="flex flex-wrap items-end">
                <TextReveal
                  as="h1"
                  splitBy="word"
                  delay={0.18}
                  staggerDelay={0.06}
                  className="hero-title text-5xl font-bold leading-[1.02] tracking-tight text-foreground text-balance sm:text-6xl lg:text-7xl xl:text-[5.25rem]"
                >
                  Flytta med mindre stress
                </TextReveal>
                <span
                  aria-hidden="true"
                  className="logo-red-dot hero-title ml-1 text-5xl font-bold leading-[1.02] sm:text-6xl lg:text-7xl xl:text-[5.25rem]"
                >
                  .
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-end">
                <TextReveal
                  as="h1"
                  splitBy="word"
                  delay={0.4}
                  staggerDelay={0.06}
                  className="hero-title text-5xl font-bold leading-[1.02] tracking-tight text-gradient-hero text-balance sm:text-6xl lg:text-7xl xl:text-[5.25rem]"
                >
                  Klar snabbare med BankID
                </TextReveal>
                <span
                  aria-hidden="true"
                  className="logo-red-dot hero-title ml-1 text-5xl font-bold leading-[1.02] sm:text-6xl lg:text-7xl xl:text-[5.25rem]"
                >
                  .
                </span>
              </div>
            </div>

            <motion.p
              variants={fadeUp}
              className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg lg:text-xl"
            >
              Skriv in det du vet, få hjälp att fylla i resten och gå vidare med
              en trygg flyttanmälan. När flytten är registrerad tar checklista,
              påminnelser och smarta erbjudanden vid.
            </motion.p>

            <div className="w-full">
              <EmbeddedLandingAida />
            </div>

            <motion.div
              variants={fadeUp}
              className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
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

            <div className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-3">
              {trustItems.map((item, i) => (
                <MovingBox
                  key={item.label}
                  intensity={7}
                  delay={1.1 + i * 0.12}
                  className="moving-box-sm flex items-center gap-3 rounded-2xl border border-border/70 bg-card/90 px-4 py-3 text-sm text-foreground shadow-sm"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <span className="leading-snug">{item.label}</span>
                </MovingBox>
              ))}
            </div>
          </motion.div>

          {SHOW_LANYARD && (
            <motion.div
              className="relative z-10 hidden w-full overflow-visible lg:mt-8 lg:block lg:min-h-[500px] lg:flex-1 xl:mt-12 xl:min-h-[600px]"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.18 }}
            >
              <div className="relative h-full overflow-visible">
                <div className="mb-4 max-w-xs lg:ml-auto lg:text-right">
                  <Badge
                    variant="outline"
                    className="rounded-full border-primary/15 bg-background/85 px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm"
                  >
                    Flyttkortet hänger kvar som visuell detalj
                  </Badge>
                </div>
                <div className="absolute inset-x-8 -top-10 bottom-8 rounded-[3rem] bg-ring/10 blur-3xl sm:inset-x-12 lg:-left-14 lg:right-4 lg:top-0 lg:bottom-16 xl:-left-24" />
                <motion.div
                  initial={{ y: -88, opacity: 0.55 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 1.15, ease: [0.16, 1, 0.3, 1], delay: 0.32 }}
                  className="relative h-full"
                >
                  <HeroLanyard />
                </motion.div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  )
}
