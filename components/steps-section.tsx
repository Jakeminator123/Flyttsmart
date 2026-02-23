"use client"

import { useRef } from "react"
import Image from "next/image"
import dynamic from "next/dynamic"
import { Fingerprint, FileCheck, Gift, CheckCircle, ArrowRight } from "lucide-react"
import Link from "next/link"
import { motion, useScroll, useTransform } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

const FloatingLines = dynamic(() => import("@/components/floating-lines"), {
  ssr: false,
})

const STEPS_GRADIENT = ["#1B3BA2", "#2E5FC7", "#4A80E0", "#6BA3F5"]

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
}

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
}

const steps = [
  {
    id: "bankid",
    icon: Fingerprint,
    number: "01",
    title: "Logga in med BankID",
    description:
      "Identifiera dig säkert – vi hämtar bara den information som krävs för flytten.",
    details: ["Mobilt BankID", "Säker identifiering", "Automatisk datahämtning", "GDPR-godkänt"],
  },
  {
    id: "flyttanmalan",
    icon: FileCheck,
    number: "02",
    title: "Vi gör flyttanmälan åt dig",
    description:
      "Flytt.io skickar din flyttanmälan till Skatteverket automatiskt, korrekt och i tid.",
    details: ["Automatisk hantering", "Direkt till Skatteverket", "Korrekt och i tid", "Inget pappersarbete"],
  },
  {
    id: "fordelar",
    icon: Gift,
    number: "03",
    title: "Få fördelar på nya adressen",
    description:
      "Du får tillgång till gratis el första månaden och kan enkelt tacka ja (eller nej) till erbjudanden på bredband, försäkring och andra nödvändiga tjänster.",
    details: ["Gratis el första månaden", "Bredband & försäkring", "Frivilliga erbjudanden", "Anpassat efter dig"],
  },
  {
    id: "klart",
    icon: CheckCircle,
    number: "04",
    title: "Klart",
    description:
      "Allt samlat på ett ställe. Inga blanketter. Ingen stress.",
    details: ["Personlig checklista", "Påminnelser", "Samlad överblick", "Helt gratis"],
  },
]

export function StepsSection() {
  const sectionRef = useRef<HTMLElement>(null)

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  })

  const linesY = useTransform(scrollYProgress, [0, 1], ["5%", "-5%"])

  return (
    <section
      ref={sectionRef}
      id="hur-det-funkar"
      className="relative overflow-hidden bg-background py-28 lg:py-36"
    >
      <div className="section-divider absolute top-0 left-0 right-0" />

      {/* FloatingLines background with parallax */}
      <motion.div
        className="pointer-events-none absolute inset-0 -top-[10%] -bottom-[10%] opacity-15"
        style={{ y: linesY }}
      >
        <FloatingLines
          linesGradient={STEPS_GRADIENT}
          enabledWaves={["bottom", "middle", "top"]}
          lineCount={[4, 6, 3]}
          lineDistance={[8, 5, 10]}
          animationSpeed={0.6}
          interactive={false}
          parallax={true}
          parallaxStrength={0.15}
        />
      </motion.div>

      <div className="pointer-events-none absolute inset-0 dot-grid opacity-40" />

      <div className="relative mx-auto max-w-7xl px-4 lg:px-8">
        <motion.div
          className="text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
        >
          <div className="mx-auto max-w-2xl">
            <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/5 px-4 py-1 text-sm font-medium text-primary">
              Så funkar det
            </Badge>
            <h2 className="mt-5 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Så fungerar
              <span className="text-gradient"> Flytt.io</span>
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
              Hela processen tar bara 2 minuter. Inget krångel, inga blanketter.
            </p>
          </div>
        </motion.div>

        {/* Desktop: Tabs layout */}
        <motion.div
          className="mt-16 hidden lg:block"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
        >
          <Tabs defaultValue="bankid" className="gap-0">
            <TabsList className="mx-auto mb-10 grid h-auto w-full max-w-2xl grid-cols-4 rounded-2xl bg-muted/80 p-2 backdrop-blur-sm">
              {steps.map((step) => (
                <TabsTrigger
                  key={step.id}
                  value={step.id}
                  className="flex items-center gap-2 rounded-xl py-3.5 text-xs data-[state=active]:bg-card data-[state=active]:shadow-lg data-[state=active]:shadow-primary/10 sm:text-sm transition-all duration-300"
                >
                  <step.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{step.title.split(" ").slice(0, 2).join(" ")}</span>
                  <span className="sm:hidden">{step.number}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            {steps.map((step) => (
              <TabsContent key={step.id} value={step.id}>
                <div className="gradient-border flex items-start gap-12 rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-10 lg:p-14">
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <span className="font-heading text-6xl font-bold text-primary/10">
                        {step.number}
                      </span>
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xl shadow-primary/25 glow">
                        <step.icon className="h-7 w-7" />
                      </div>
                    </div>
                    <h3 className="mt-8 font-heading text-2xl font-bold text-card-foreground">
                      {step.title}
                    </h3>
                    <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
                      {step.description}
                    </p>
                    <div className="mt-8 h-px w-full bg-linear-to-r from-border via-primary/20 to-transparent" />
                    <div className="mt-8 grid grid-cols-2 gap-4">
                      {step.details.map((detail) => (
                        <div key={detail} className="flex items-center gap-3 text-sm text-muted-foreground">
                          <div className="h-2 w-2 rounded-full bg-primary/60 shadow-sm shadow-primary/40" />
                          {detail}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="hidden shrink-0 xl:block">
                    <div className="relative">
                      <div className="absolute -inset-4 rounded-3xl bg-primary/5 blur-2xl" />
                      <Image
                        src="/media/images/glad_tjej.webp"
                        alt="En glad tjej visar en QR-kod på sin telefon"
                        width={220}
                        height={320}
                        className="relative h-72 w-auto rounded-2xl object-cover shadow-lg"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </motion.div>

        {/* Mobile: Card grid */}
        <motion.div
          className="mt-16 grid gap-6 sm:grid-cols-2 lg:hidden"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          variants={stagger}
        >
          {steps.map((step) => (
            <motion.div key={step.number} variants={fadeUp}>
              <div className="gradient-border group relative flex h-full flex-col rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6 transition-all duration-500 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-2">
                <div className="mb-4 flex items-center gap-3">
                  <span className="font-heading text-4xl font-bold text-primary/10 transition-colors duration-500 group-hover:text-primary/25">
                    {step.number}
                  </span>
                </div>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-500 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-xl group-hover:shadow-primary/25 group-hover:scale-110">
                  <step.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 font-heading text-lg font-semibold text-card-foreground">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA under steps */}
        <motion.div
          className="mt-14 text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
        >
          <Button asChild size="lg" className="shimmer-btn rounded-full px-8 gap-2 shadow-lg shadow-primary/20 transition-all duration-300 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5">
            <Link href="/adressandring">
              Starta din flyttanmälan
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  )
}
