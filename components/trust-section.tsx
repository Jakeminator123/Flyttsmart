"use client"

import { useRef } from "react"
import Image from "next/image"
import { ShieldCheck, Lock, FileCheck, Fingerprint, Info, Zap, Clock, Users } from "lucide-react"
import { motion, useScroll, useTransform } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { TextReveal } from "@/components/text-reveal"
import { AnimatedCounter } from "@/components/animated-counter"
import { Marquee } from "@/components/marquee"

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

const marqueeItems = [
  { icon: ShieldCheck, text: "Bankgiro-trygg" },
  { icon: Lock, text: "SSL-krypterat" },
  { icon: Fingerprint, text: "BankID-verifierat" },
  { icon: Users, text: "12 000+ användare" },
  { icon: Zap, text: "Klar på 2 min" },
  { icon: Clock, text: "Tillgänglig 24/7" },
  { icon: FileCheck, text: "GDPR-kompatibel" },
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
      className="relative overflow-hidden bg-background py-28 lg:py-36"
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
            className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground"
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
          className="mx-auto mt-14 flex max-w-2xl items-center justify-center gap-8 sm:gap-16"
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

        {/* Trust signal marquee */}
        <div className="mt-14">
          <Marquee speed={30} className="py-4">
            {marqueeItems.map((item) => (
              <div key={item.text} className="flex items-center gap-2.5 rounded-full border border-border/50 bg-card/82 px-5 py-2.5 text-sm font-medium text-muted-foreground backdrop-blur-md">
                <item.icon className="h-4 w-4 text-primary" />
                {item.text}
              </div>
            ))}
          </Marquee>
        </div>

        {/* Trust cards */}
        <motion.div
          className="mt-14 grid gap-6 sm:grid-cols-3"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
        >
          {trustSignals.map((signal) => (
            <motion.div key={signal.title} variants={fadeUp}>
              <div className="gradient-border card-3d card-hover group flex h-full flex-col items-center rounded-2xl border border-border/50 bg-card/90 p-9 text-center backdrop-blur-sm">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-all duration-500 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-xl group-hover:shadow-primary/25 group-hover:scale-110">
                  <signal.icon className="h-8 w-8" />
                </div>
                <h3 className="mb-3 font-heading text-lg font-semibold text-card-foreground">
                  {signal.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {signal.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Security banner */}
        <motion.div
          className="mt-16"
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="gradient-border card-3d relative overflow-hidden rounded-2xl shadow-2xl shadow-primary/10">
            <Image
              src="/images/secure-form.jpg"
              alt="En laptop med ett säkert formulär på skärmen bredvid en kopp kaffe på ett ljust skrivbord"
              width={1200}
              height={480}
              className="h-64 w-full object-cover sm:h-80 lg:h-96"
            />
            <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-primary/15 via-transparent to-primary/10" />
            <div className="absolute inset-0 bg-linear-to-t from-foreground/70 via-foreground/20 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary" className="glass gap-1.5 px-3 py-1.5 text-card-foreground">
                  <Fingerprint className="h-4 w-4" />
                  BankID
                </Badge>
                <Badge variant="secondary" className="glass gap-1.5 px-3 py-1.5 text-card-foreground">
                  <ShieldCheck className="h-4 w-4" />
                  GDPR
                </Badge>
                <Badge variant="secondary" className="glass gap-1.5 px-3 py-1.5 text-card-foreground">
                  <Lock className="h-4 w-4" />
                  SSL-krypterad
                </Badge>
              </div>

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary" size="sm" className="glass gap-1.5 rounded-full text-card-foreground">
                    <Info className="h-3.5 w-3.5" />
                    Läs mer
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Så skyddar vi dina uppgifter</DialogTitle>
                    <DialogDescription>
                      Information om vår säkerhet och datahantering
                    </DialogDescription>
                  </DialogHeader>
                  <Separator />
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <Fingerprint className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">Säker BankID-inloggning</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Vi använder Mobilt BankID för säker identifiering – samma teknik som din bank.
                        </p>
                      </div>
                    </div>
                    <Separator />
                    <div className="flex gap-3">
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">GDPR-kompatibel</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Vi följer EU:s dataskyddsförordning. Dina personuppgifter lagras säkert och delas aldrig utan ditt samtycke.
                        </p>
                      </div>
                    </div>
                    <Separator />
                    <div className="flex gap-3">
                      <FileCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">100% gratis</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Flytt.io kostar inget för dig. Inga dolda avgifter, inga överraskningar.
                        </p>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
