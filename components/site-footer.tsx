"use client"

import Link from "next/link"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { ScrollReveal } from "@/components/scroll-reveal"
import { Logo } from "@/components/logo"
import { Mail, Phone, MapPin } from "lucide-react"

export function SiteFooter() {
  return (
    <footer
      id="kontakt"
      className="relative border-t border-border bg-card py-16"
    >
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <ScrollReveal>
          <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
            {/* Brand */}
            <div className="max-w-sm">
              <Link href="/" aria-label="Flyttsmart - Till startsidan">
                <Logo size="md" />
              </Link>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Flyttsmart gör din adressändring snabb och enkel. Vi ser till
                att din post kommer rätt när du flyttar.
              </p>
              <div className="mt-6 flex flex-col gap-2.5">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a href="mailto:info@flyttsmart.se" className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary">
                        <Mail className="h-4 w-4" />
                        info@flyttsmart.se
                      </a>
                    </TooltipTrigger>
                    <TooltipContent>Skicka oss ett mejl</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a href="tel:+46101234567" className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary">
                        <Phone className="h-4 w-4" />
                        010-123 45 67
                      </a>
                    </TooltipTrigger>
                    <TooltipContent>Ring oss vardagar 8-17</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  Stockholm, Sverige
                </div>
              </div>
            </div>

            {/* Link columns */}
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
              <div>
                <h3 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wider text-foreground">
                  Tjänster
                </h3>
                <ul className="flex flex-col gap-2.5">
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
                <h3 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wider text-foreground">
                  Juridiskt
                </h3>
                <ul className="flex flex-col gap-2.5">
                  <li>
                    <a
                      href="#"
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      Allmänna villkor
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      Integritetspolicy
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      Cookies
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wider text-foreground">
                  Kontakt
                </h3>
                <ul className="flex flex-col gap-2.5">
                  <li>
                    <a
                      href="#"
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      Kontakta oss
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      Kundservice
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </ScrollReveal>

        <Separator className="my-10" />

        {/* Bottom bar */}
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-xs text-muted-foreground">
            &copy; 2026 Flyttsmart. Alla rättigheter förbehållna.
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <a href="#" className="transition-colors hover:text-primary">
              Villkor
            </a>
            <Separator orientation="vertical" className="h-3" />
            <a href="#" className="transition-colors hover:text-primary">
              Integritet
            </a>
            <Separator orientation="vertical" className="h-3" />
            <a href="#" className="transition-colors hover:text-primary">
              Cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
