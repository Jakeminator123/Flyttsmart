"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { ArrowRight, ChevronDown, CheckCircle, Shield, Fingerprint } from "lucide-react"
import { motion, useScroll, useTransform } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { HeroVisual } from "@/components/hero-visual"

const stagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.2 },
  },
}

const fadeUp = {
  hidden: { opacity: 0, y: 40, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
  },
}

const scaleIn = {
  hidden: { opacity: 0, scale: 0.88, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const },
  },
}

const TRUST_ITEMS = [
  { icon: CheckCircle, label: "Gratis", tip: "Tjänsten kostar inget för dig" },
  { icon: Fingerprint, label: "Säker BankID-inloggning", tip: "Identifiera dig tryggt med Mobilt BankID" },
  { icon: Shield, label: "GDPR-godkänd", tip: "Din data hanteras enligt dataskyddsförordningen" },
]

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  })

  const videoY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"])
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "15%"])
  const overlayOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = 0.5
  }, [])

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative min-h-screen overflow-hidden"
    >
      {/* Video background with parallax */}
      <motion.div
        className="absolute inset-0 -top-[10%] -bottom-[10%]"
        style={{ y: videoY }}
      >
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          src="/media/videos/hero.mp4"
          autoPlay
          muted
          playsInline
          preload="auto"
        />
      </motion.div>

      {/* Blue gradient overlay */}
      <div className="hero-mesh" />
      <div className="hero-mesh-accent" />

      {/* Dark vignette for text readability */}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-background/60 via-background/30 to-background" />

      {/* Dot grid pattern */}
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-30" />

      {/* Content with parallax */}
      <motion.div
        style={{ y: contentY, opacity: overlayOpacity }}
        className="relative mx-auto flex max-w-7xl flex-col items-center gap-16 px-4 pt-36 pb-20 lg:flex-row lg:items-center lg:gap-16 lg:px-8 lg:pt-44 lg:pb-28 xl:gap-20"
      >
        {/* Left column: text content */}
        <motion.div
          className="flex flex-1 flex-col items-center text-center lg:items-start lg:text-left"
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={fadeUp}>
            <Badge variant="outline" className="gap-2 rounded-full border-primary/30 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Helt gratis flyttanmälan
            </Badge>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="mt-8 font-heading text-5xl font-bold leading-[1.08] tracking-tight text-foreground text-balance sm:text-6xl lg:text-7xl xl:text-8xl"
          >
            Flytta utan krångel.
            <span className="mt-2 block text-gradient">
              Klar på 2&nbsp;minuter.
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty lg:text-xl"
          >
            Vi gör din flyttanmälan till Skatteverket automatiskt – och hjälper
            dig komma igång på nya adressen med el, bredband och försäkring.
            Helt gratis.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
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
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="rounded-full text-base text-muted-foreground hover:text-foreground"
            >
              <a href="#hur-det-funkar">
                Så funkar det
                <ChevronDown className="ml-1 h-4 w-4" />
              </a>
            </Button>
          </motion.div>

          <motion.div variants={fadeUp}>
            <TooltipProvider>
              <div className="mt-10 flex flex-wrap items-center gap-4 text-sm text-muted-foreground lg:gap-6">
                {TRUST_ITEMS.map((item) => (
                  <Tooltip key={item.label}>
                    <TooltipTrigger asChild>
                      <div className="glass flex cursor-default items-center gap-2 rounded-full px-3.5 py-2 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
                        <item.icon className="h-4 w-4 text-primary" />
                        <span>{item.label}</span>
                      </div>
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
          className="flex-1 w-full lg:max-w-md"
        >
          <div className="relative">
            <div className="absolute -inset-8 rounded-4xl bg-primary/8 blur-3xl animate-float-slow" />
            <HeroVisual />
          </div>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="flex h-10 w-6 items-start justify-center rounded-full border-2 border-muted-foreground/30 pt-2">
          <motion.div
            className="h-1.5 w-1.5 rounded-full bg-primary"
            animate={{ y: [0, 12, 0], opacity: [1, 0.3, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </motion.div>
    </section>
  )
}
