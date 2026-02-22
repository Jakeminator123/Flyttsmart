"use client"

import Link from "next/link"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { ScrollReveal } from "@/components/scroll-reveal"
import { Logo } from "@/components/logo"
import { Mail, MapPin } from "lucide-react"

export function SiteFooter() {
  return (
    <footer
      id="kontakt"
      className="relative overflow-hidden border-t border-border/50 bg-card py-20"
    >
      {/* Animated background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="section-orb-1 -bottom-1/4 left-1/4 h-100 w-100" />
        <div className="section-orb-2 -top-1/4 -right-1/4 h-75 w-75" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 lg:px-8">
        <ScrollReveal>
          <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
            {/* Brand */}
            <div className="max-w-sm">
              <Link href="/" aria-label="Flytt.io - Till startsidan">
                <Logo size="md" />
              </Link>
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
                Flytt.io gör din flyttanmälan enkel och gratis. Vi hjälper dig
                med allt från Skatteverket till el och bredband på nya adressen.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a href="mailto:info@flytt.io" className="flex items-center gap-2.5 text-sm text-muted-foreground transition-colors hover:text-primary">
                        <Mail className="h-4 w-4" />
                        info@flytt.io
                      </a>
                    </TooltipTrigger>
                    <TooltipContent>Skicka oss ett mejl</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  Stockholm, Sverige
                </div>
              </div>
            </div>

            {/* Link columns */}
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
              <div>
                <h3 className="mb-4 font-heading text-sm font-semibold uppercase tracking-wider text-foreground">
                  Tjänster
                </h3>
                <ul className="flex flex-col gap-3">
                  <li>
                    <Link
                      href="/adressandring"
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      Adressändring
                    </Link>
                  </li>
                  <li>
                    <a
                      href="#hur-det-funkar"
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      Så funkar det
                    </a>
                  </li>
                  <li>
                    <a
                      href="#faq"
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      Vanliga frågor
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="mb-4 font-heading text-sm font-semibold uppercase tracking-wider text-foreground">
                  Juridiskt
                </h3>
                <ul className="flex flex-col gap-3">
                  <li>
                    <Link
                      href="/anvandarvillkor"
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      Användarvillkor
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/integritetspolicy"
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      Integritetspolicy
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/cookiepolicy"
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      Cookies
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="mb-4 font-heading text-sm font-semibold uppercase tracking-wider text-foreground">
                  Om oss
                </h3>
                <ul className="flex flex-col gap-3">
                  <li>
                    <Link
                      href="/om"
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      Om Flytt.io
                    </Link>
                  </li>
                  <li>
                    <a
                      href="mailto:info@flytt.io"
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      Kontakta oss
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </ScrollReveal>

        <Separator className="my-12" />

        {/* Bottom bar */}
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-xs text-muted-foreground">
            &copy; 2026 Flytt.io. Alla rättigheter förbehållna.
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link href="/anvandarvillkor" className="transition-colors hover:text-primary">
              Villkor
            </Link>
            <Separator orientation="vertical" className="h-3" />
            <Link href="/integritetspolicy" className="transition-colors hover:text-primary">
              Integritet
            </Link>
            <Separator orientation="vertical" className="h-3" />
            <Link href="/cookiepolicy" className="transition-colors hover:text-primary">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
