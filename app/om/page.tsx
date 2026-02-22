import type { Metadata } from "next"
import { Fingerprint, ClipboardList, Gift, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ScrollReveal } from "@/components/scroll-reveal"
import { Header } from "@/components/header"
import { SiteFooter } from "@/components/site-footer"
import { OpenClawChatWidget } from "@/components/openclaw-chat-widget"

export const metadata: Metadata = {
  title: "Om Flytt.io – Flyttanmälan som den borde fungera",
  description: "Flytt.io är en digital tjänst som hjälper dig att komma igång med din flytt på ett smartare sätt.",
}

const features = [
  {
    icon: Fingerprint,
    title: "Logga in med BankID",
    description: "Göra din flyttanmälan korrekt och i tid",
  },
  {
    icon: ClipboardList,
    title: "Personlig checklista",
    description: "Få en tydlig, datumsatt checklista anpassad efter just din flytt",
  },
  {
    icon: Gift,
    title: "Frivilliga erbjudanden",
    description: "Ta del av relevanta erbjudanden som el, bredband och försäkring",
  },
  {
    icon: ShieldCheck,
    title: "Säkerhet & transparens",
    description: "BankID, kryptering och dataskydd enligt GDPR",
  },
]

export default function OmPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <Header />
      <main className="flex-1">
        <section className="relative overflow-hidden bg-linear-to-b from-hero-gradient-from to-background pt-36 pb-20 lg:pt-44 lg:pb-28">
          {/* Background orbs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <div className="section-orb-1 -top-1/4 -right-1/4 h-125 w-125" />
            <div className="section-orb-accent -bottom-1/3 -left-1/4 h-125 w-125" />
            <div className="absolute inset-0 dot-grid opacity-20" />
          </div>

          <div className="relative mx-auto max-w-4xl px-4 lg:px-8">
            <ScrollReveal className="text-center">
              <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/5 px-4 py-1 text-sm font-medium text-primary">
                Om oss
              </Badge>
              <h1 className="mt-5 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                Om
                <span className="text-gradient"> Flytt.io</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                Att flytta borde vara enkelt. Ändå upplever många att första steget – flyttanmälan och allt runt omkring – är krångligt, tidskrävande och lätt att göra fel. Det var där idén till Flytt.io föddes.
              </p>
            </ScrollReveal>

            {/* Mission */}
            <ScrollReveal delay={200}>
              <div className="mt-16 gradient-border rounded-2xl border border-border/50 bg-card p-8 lg:p-12">
                <h2 className="font-heading text-2xl font-bold text-foreground">
                  Flyttanmälan som den borde fungera
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  Flytt.io är en digital tjänst som hjälper dig att komma igång med din flytt på ett smartare sätt. Vi gör flyttanmälan enklare och samlar allt det viktigaste på ett ställe – från myndighetsärenden till praktisk planering och relevanta erbjudanden på din nya adress.
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  I stället för blanketter, separata sajter och långa checklistor använder vi modern teknik för att skapa en personlig flyttupplevelse som faktiskt sparar tid.
                </p>
              </div>
            </ScrollReveal>

            {/* How it works */}
            <ScrollReveal delay={300}>
              <h2 className="mt-16 text-center font-heading text-2xl font-bold text-foreground">
                Hur det fungerar i praktiken
              </h2>
              <p className="mt-3 text-center text-sm text-muted-foreground">
                När du loggar in med BankID hjälper vi dig att:
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {features.map((feature, i) => (
                  <div key={feature.title} className="gradient-border group flex items-start gap-4 rounded-xl border border-border/50 bg-card p-5 transition-all duration-500 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-500 group-hover:bg-primary group-hover:text-primary-foreground">
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-heading text-sm font-semibold text-card-foreground">{feature.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Allt samlat på ett ställe. Helt gratis.
              </p>
            </ScrollReveal>

            {/* Free model */}
            <ScrollReveal delay={400}>
              <div className="mt-16 gradient-border rounded-2xl border border-border/50 bg-card p-8 lg:p-12">
                <h2 className="font-heading text-2xl font-bold text-foreground">
                  Gratis för dig – smart för alla
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  Flytt.io kostar inget för dig som användare. Tjänsten finansieras genom samarbeten med utvalda partners som kan erbjuda produkter och tjänster kopplade till flytt och boende.
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Vi tror på transparens och valfrihet. Det betyder att alla erbjudanden är frivilliga, du väljer själv vad du vill ta del av, och vi visar bara sådant som är relevant för din situation.
                </p>
              </div>
            </ScrollReveal>

            {/* Vision */}
            <ScrollReveal delay={500}>
              <div className="mt-16 text-center">
                <h2 className="font-heading text-2xl font-bold text-foreground">Vår vision</h2>
                <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Vi vill att Flytt.io ska bli den självklara startpunkten för alla som ska flytta i Sverige – oavsett om det är första lägenheten, en större villa eller ett nytt kapitel i livet.
                  En plats där flytten känns hanterbar, begriplig och lite mindre stressig.
                </p>
                <p className="mt-6 font-heading text-lg font-semibold text-primary">
                  Flytt.io – flytta smartare, från första steget.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>
      <SiteFooter />
      <OpenClawChatWidget formType="om" />
    </div>
  )
}
