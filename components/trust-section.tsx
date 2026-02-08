"use client"

import Image from "next/image"
import { ShieldCheck, Lock, FileCheck, CreditCard, Info } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
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
    icon: ShieldCheck,
    title: "Säker checkout",
    description: "All betalning sker via krypterade anslutningar med banksäkerhet.",
  },
  {
    icon: Lock,
    title: "Krypterad data",
    description: "Dina personuppgifter skyddas med modern kryptering hela vägen.",
  },
  {
    icon: FileCheck,
    title: "Tydliga villkor",
    description: "Inga dolda avgifter. Transparent pris före betalning.",
  },
]

const paymentMethods = [
  { name: "Visa", icon: CreditCard },
  { name: "Mastercard", icon: CreditCard },
  { name: "Swish", icon: CreditCard },
]

export function TrustSection() {
  return (
    <section className="relative bg-background py-24 lg:py-32">
      <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-border to-transparent" />

      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <ScrollReveal className="text-center">
          <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-4 py-1 text-sm font-medium text-primary">
            Tryggt val
          </Badge>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Säkerheten du förtjänar
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Används av tusentals flyttare varje månad. Dina uppgifter hanteras tryggt och säkert.
          </p>
        </ScrollReveal>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {trustSignals.map((signal, i) => (
            <ScrollReveal key={signal.title} delay={i * 150}>
              <Card className="group h-full border-border transition-all duration-500 hover:border-primary/20 hover:shadow-lg hover:-translate-y-1.5">
                <CardContent className="flex flex-col items-center p-8 text-center">
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-all duration-500 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-lg group-hover:shadow-primary/25 group-hover:scale-110">
                    <signal.icon className="h-7 w-7" />
                  </div>
                  <h3 className="mb-2 font-heading text-lg font-semibold text-card-foreground">
                    {signal.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {signal.description}
                  </p>
                </CardContent>
              </Card>
            </ScrollReveal>
          ))}
        </div>

        {/* Payment section with image */}
        <ScrollReveal delay={200} className="mt-16">
          <div className="relative overflow-hidden rounded-2xl border border-border/50 shadow-xl">
            <Image
              src="/images/secure-form.jpg"
              alt="En laptop med ett säkert formulär på skärmen bredvid en kopp kaffe på ett ljust skrivbord"
              width={1200}
              height={480}
              className="h-64 w-full object-cover sm:h-80 lg:h-96"
            />
            <div className="absolute inset-0 bg-linear-to-t from-foreground/70 via-foreground/20 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                {paymentMethods.map((method) => (
                  <Badge key={method.name} variant="secondary" className="gap-1.5 bg-card/90 px-3 py-1.5 text-card-foreground backdrop-blur-sm">
                    <method.icon className="h-4 w-4" />
                    {method.name}
                  </Badge>
                ))}
                <Badge variant="secondary" className="gap-1.5 bg-card/90 px-3 py-1.5 text-card-foreground backdrop-blur-sm">
                  <ShieldCheck className="h-4 w-4" />
                  SSL-krypterad
                </Badge>
              </div>

              {/* Dialog for payment info */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary" size="sm" className="gap-1.5 rounded-full bg-card/90 backdrop-blur-sm">
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
                      <Lock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">256-bit SSL-kryptering</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          All kommunikation mellan din webbläsare och våra servrar är krypterad med samma teknik som banker använder.
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
                        <p className="text-sm font-semibold text-foreground">Transparent prissättning</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Alla kostnader visas tydligt innan du genomför betalningen. Inga dolda avgifter, inga överraskningar.
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
