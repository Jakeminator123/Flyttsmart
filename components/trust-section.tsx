"use client"

import Image from "next/image"
import { ShieldCheck, Lock, FileCheck, Fingerprint, Info } from "lucide-react"
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
import { ScrollReveal } from "@/components/scroll-reveal"

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
  return (
    <section id="sakerhet" className="relative overflow-hidden bg-background py-28 lg:py-36">
      <div className="section-divider absolute top-0 left-0 right-0" />

      {/* Animated background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="section-orb-2 -top-1/3 -left-1/4 h-150 w-150" />
        <div className="section-orb-1 -bottom-1/3 -right-1/3 h-125 w-125" />
        <div className="absolute inset-0 dot-grid opacity-[0.05]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <ScrollReveal className="text-center">
          <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/5 px-4 py-1 text-sm font-medium text-primary">
            Tryggt val
          </Badge>
          <h2 className="mt-5 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Säkerheten du
            <span className="text-gradient"> förtjänar</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Används av tusentals flyttare varje månad. Dina uppgifter hanteras tryggt och säkert.
          </p>
        </ScrollReveal>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {trustSignals.map((signal, i) => (
            <ScrollReveal key={signal.title} delay={i * 150}>
              <div className="gradient-border group flex h-full flex-col items-center rounded-2xl border border-border/50 bg-card p-9 text-center transition-all duration-500 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-2">
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
            </ScrollReveal>
          ))}
        </div>

        {/* Payment section with image */}
        <ScrollReveal delay={200} className="mt-16">
          <div className="gradient-border relative overflow-hidden rounded-2xl shadow-2xl shadow-primary/10">
            <Image
              src="/images/secure-form.jpg"
              alt="En laptop med ett säkert formulär på skärmen bredvid en kopp kaffe på ett ljust skrivbord"
              width={1200}
              height={480}
              className="h-64 w-full object-cover sm:h-80 lg:h-96"
            />
            {/* Animated blue shimmer overlay */}
            <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-primary/15 via-transparent to-primary/10 animate-pulse" />
            <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/10 via-transparent to-primary/5 mix-blend-overlay" />
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
                    Läs mer om säkerhet
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
        </ScrollReveal>
      </div>
    </section>
  )
}
