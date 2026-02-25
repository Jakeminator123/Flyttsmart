"use client"

import { useRef, type MouseEvent as ReactMouseEvent } from "react"
import Link from "next/link"
import { ArrowRight, ChevronDown, CheckCircle, Shield, Fingerprint } from "lucide-react"
import { motion, useScroll, useTransform, useReducedMotion, useMotionValue, useSpring } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { HeroVisual } from "@/components/hero-visual"
import { TextReveal } from "@/components/text-reveal"
import { MagneticButton } from "@/components/magnetic-button"
import { HeroCinemagraph } from "@/components/hero-cinemagraph"
import { HeroWaveElectrons } from "@/components/hero-wave-electrons"

const fadeUp = {
  hidden: { opacity: 0, y: 30, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const },
  },
}

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15, delayChildren: 0.1 } },
}

const scaleIn = {
  hidden: { opacity: 0, scale: 0.85, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 1, ease: [0.16, 1, 0.3, 1] as const, delay: 0.4 },
  },
}

const TRUST_ITEMS = [
  { icon: CheckCircle, label: "Gratis", tip: "Tjänsten kostar inget för dig" },
  { icon: Fingerprint, label: "Säker BankID", tip: "Identifiera dig tryggt med Mobilt BankID" },
  { icon: Shield, label: "GDPR-godkänd", tip: "Din data hanteras enligt dataskyddsförordningen" },
]

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const pointerX = useMotionValue(0)
  const pointerY = useMotionValue(0)
  const springX = useSpring(pointerX, { stiffness: 140, damping: 20, mass: 0.6 })
  const springY = useSpring(pointerY, { stiffness: 140, damping: 20, mass: 0.6 })

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  })

  const videoY = useTransform(scrollYProgress, [0, 1], ["0%", prefersReducedMotion ? "0%" : "18%"])
  const videoScale = useTransform(scrollYProgress, [0, 1], [1, prefersReducedMotion ? 1 : 1.08])
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", prefersReducedMotion ? "0%" : "12%"])
  const overlayOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0])
  const handlePointerMove = (event: ReactMouseEvent<HTMLElement>) => {
    if (prefersReducedMotion || !sectionRef.current) return
    const rect = sectionRef.current.getBoundingClientRect()
    const offsetX = event.clientX - rect.left - rect.width / 2
    const offsetY = event.clientY - rect.top - rect.height / 2
    pointerX.set((offsetX / rect.width) * 12)
    pointerY.set((offsetY / rect.height) * 10)
  }

  const handlePointerLeave = () => {
    pointerX.set(0)
    pointerY.set(0)
  }

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative min-h-svh overflow-hidden bg-foreground/5"
      style={{ position: "relative" }}
      onMouseMove={handlePointerMove}
      onMouseLeave={handlePointerLeave}
    >
      {/* Cinemagraph background with parallax */}
      <motion.div
        className="absolute inset-0 top-[2%] h-[116%] sm:top-[1%] md:top-0 md:h-[120%] lg:-top-[5%] lg:h-[125%]"
        style={{ y: videoY, scale: videoScale }}
      >
        <HeroCinemagraph className="relative h-full w-full" />
      </motion.div>

      {/* Minimal overlays for readability without killing the video */}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-background/42 via-background/10 to-background/74" />
      <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-background/58 via-background/20 to-transparent lg:from-background/52" />

      {/* Animated wave pattern with electron dots */}
      <div className="pointer-events-none absolute inset-0 z-1" aria-hidden="true">
        <HeroWaveElectrons className="h-full w-full" />
      </div>

      {/* Kinetic wordmark */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center overflow-hidden"
        style={{ y: prefersReducedMotion ? 0 : contentY }}
        aria-hidden="true"
      >
        <span className="hero-wordmark">flytt.io</span>
      </motion.div>

      {/* Content */}
      <motion.div
        style={{ y: contentY, opacity: overlayOpacity }}
        className="relative z-20 mx-auto flex max-w-7xl flex-col items-center gap-10 px-4 pt-32 pb-24 sm:pt-36 sm:pb-20 lg:flex-row lg:items-center lg:gap-16 lg:px-8 lg:pt-44 lg:pb-28 xl:gap-20"
      >
        {/* Left column: text */}
        <motion.div
          className="relative flex flex-1 flex-col items-center text-center lg:items-start lg:text-left"
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-3 -inset-y-4 -z-10 rounded-3xl bg-linear-to-br from-background/78 via-background/56 to-background/16 backdrop-blur-[1.5px] lg:-inset-x-6"
          />
          <motion.div variants={fadeUp}>
            <Badge variant="outline" className="gap-2 rounded-full border-foreground/15 bg-background/80 px-4 py-1.5 text-sm font-medium text-foreground backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Helt gratis flyttanmälan
            </Badge>
          </motion.div>

          {/* 3D-interactive heading */}
          <motion.div
            className="mt-6 sm:mt-8"
            style={{ x: springX, y: springY }}
          >
            <TextReveal
              as="h1"
              splitBy="word"
              delay={0.3}
              staggerDelay={0.08}
              className="hero-title text-4xl font-bold leading-[1.08] tracking-tight text-foreground text-balance sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl"
            >
              Flytta utan krångel.
            </TextReveal>
            <TextReveal
              as="h1"
              splitBy="word"
              delay={0.7}
              staggerDelay={0.08}
              className="hero-title mt-1 text-4xl font-bold leading-[1.08] tracking-tight text-gradient-hero sm:mt-2 sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl"
            >
              Klar på 2 minuter.
            </TextReveal>
          </motion.div>

          <motion.p
            variants={fadeUp}
            className="mt-6 max-w-xl text-base leading-relaxed text-foreground/80 text-pretty sm:mt-8 sm:text-lg lg:text-xl"
          >
            Vi gör din flyttanmälan till Skatteverket automatiskt – och hjälper
            dig komma igång på nya adressen med el, bredband och försäkring.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:items-center sm:gap-4">
            <MagneticButton strength={0.15}>
              <div className="relative">
                <div className="absolute -inset-1 rounded-full bg-primary/20 animate-pulse-ring" />
                <Button
                  asChild
                  size="lg"
                  className="shimmer-btn relative rounded-full px-8 text-base font-semibold shadow-xl shadow-primary/25 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/35 hover:-translate-y-1"
                >
                  <Link href="/adressandring">
                    Starta din flytt med BankID
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </MagneticButton>
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="rounded-full text-base text-foreground/70 hover:text-foreground"
            >
              <a href="#hur-det-funkar">
                Så funkar det
                <ChevronDown className="ml-1 h-4 w-4" />
              </a>
            </Button>
          </motion.div>

          <motion.div variants={fadeUp}>
            <TooltipProvider>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm sm:mt-10 lg:justify-start lg:gap-4">
                {TRUST_ITEMS.map((item, i) => (
                  <Tooltip key={item.label}>
                    <TooltipTrigger asChild>
                      <motion.div
                        className="flex cursor-default items-center gap-2 rounded-full border border-foreground/15 bg-background/72 px-3 py-1.5 text-xs text-foreground/85 backdrop-blur-md transition-all duration-300 hover:bg-background/90 hover:-translate-y-0.5 sm:px-3.5 sm:py-2 sm:text-sm"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.4 + i * 0.1, duration: 0.5 }}
                      >
                        <item.icon className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />
                        <span>{item.label}</span>
                      </motion.div>
                    </TooltipTrigger>
                    <TooltipContent>{item.tip}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
          </motion.div>
        </motion.div>

        {/* Right column: app preview */}
        <motion.div
          variants={scaleIn}
          initial="hidden"
          animate="visible"
          className="hidden w-full flex-1 sm:block lg:max-w-md"
        >
          <div className="relative">
            <div className="absolute -inset-8 rounded-4xl bg-primary/8 blur-3xl animate-float-slow" />
            <HeroVisual />
          </div>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 sm:flex flex-col items-center gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
      >
        <motion.span
          className="text-xs font-medium uppercase tracking-widest text-foreground/45"
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          Scrolla
        </motion.span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="flex h-10 w-6 items-start justify-center rounded-full border-2 border-foreground/20 pt-2">
            <motion.div
              className="h-1.5 w-1.5 rounded-full bg-primary"
              animate={{ y: [0, 12, 0], opacity: [1, 0.3, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        </motion.div>
      </motion.div>

      {/* Bottom fade */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-linear-to-t from-background to-transparent" />
    </section>
  )
}
