"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Logo } from "@/components/logo"

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100)
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      clearTimeout(timer)
      window.removeEventListener("scroll", handleScroll)
    }
  }, [])

  const navLinks = [
    { label: "Hur det funkar", href: "#hur-det-funkar" },
    { label: "Fördelar", href: "#fordelar" },
    { label: "Omdömen", href: "#omdomnen" },
    { label: "Vanliga frågor", href: "#faq" },
  ]

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-700 ease-out",
        scrolled
          ? "glass shadow-lg shadow-primary/5"
          : "bg-transparent"
      )}
    >
      {/* Animated gradient line on scroll */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 h-px transition-opacity duration-700",
          scrolled ? "opacity-100" : "opacity-0"
        )}
        aria-hidden="true"
      >
        <div className="section-divider h-full w-full" />
      </div>

      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          aria-label="Flyttsmart - Till startsidan"
          className={cn(
            "transition-all duration-700 ease-out",
            mounted
              ? "opacity-100 translate-x-0"
              : "opacity-0 -translate-x-6"
          )}
        >
          <Logo size="sm" />
        </Link>

        {/* Nav links */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Huvudnavigering">
          {navLinks.map((link, i) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                "group relative rounded-lg px-3.5 py-2 text-sm font-medium text-muted-foreground transition-all duration-500 ease-out hover:text-foreground",
                mounted
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 -translate-y-3"
              )}
              style={{
                transitionDelay: mounted ? `${200 + i * 80}ms` : "0ms",
              }}
            >
              {link.label}
              <span
                className="absolute bottom-0.5 left-3.5 right-3.5 h-0.5 origin-left scale-x-0 rounded-full bg-primary transition-transform duration-300 ease-out group-hover:scale-x-100"
                aria-hidden="true"
              />
            </a>
          ))}
        </nav>

        {/* CTA button */}
        <div
          className={cn(
            "hidden md:block transition-all duration-700 ease-out",
            mounted
              ? "opacity-100 translate-x-0"
              : "opacity-0 translate-x-6"
          )}
          style={{ transitionDelay: mounted ? "550ms" : "0ms" }}
        >
          <Button asChild size="sm" className="group rounded-full px-5 gap-1.5 shadow-lg shadow-primary/15 transition-all duration-300 hover:shadow-xl hover:shadow-primary/25 hover:-translate-y-0.5">
            <Link href="/adressandring">
              Gör adressändring
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </div>

        {/* Mobile menu */}
        <button
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg text-foreground transition-all duration-500 ease-out hover:bg-primary/10 md:hidden",
            mounted
              ? "opacity-100 translate-x-0"
              : "opacity-0 translate-x-4"
          )}
          style={{ transitionDelay: mounted ? "300ms" : "0ms" }}
          onClick={() => setSheetOpen(true)}
          aria-label="Öppna meny"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Mobile Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-80">
          <SheetHeader>
            <SheetTitle>
              <Logo size="sm" />
            </SheetTitle>
            <SheetDescription className="sr-only">
              Navigeringsmeny för Flyttsmart
            </SheetDescription>
          </SheetHeader>
          <Separator />
          <nav className="flex flex-col gap-1 px-2 py-4" aria-label="Mobilnavigering">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
                onClick={() => setSheetOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <Separator />
          <div className="px-2 py-4">
            <Button asChild className="w-full rounded-full gap-1.5 shadow-lg shadow-primary/20">
              <Link href="/adressandring" onClick={() => setSheetOpen(false)}>
                Gör adressändring
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
