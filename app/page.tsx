"use client";

import { useEffect } from "react";
import { Header } from "@/components/header";
import { HeroSection } from "@/components/hero-section";
import { StepsSection } from "@/components/steps-section"
import { TrustSection } from "@/components/trust-section"
import { FaqSection } from "@/components/faq-section"
import { SiteFooter } from "@/components/site-footer"
import { MobileCta } from "@/components/mobile-cta"

export default function HomePage() {
  useEffect(() => {
    if (window.location.hash) return

    const previousScrollRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = "manual"

    const resetScroll = () => {
      window.scrollTo(0, 0)
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }

    resetScroll()
    const frameId = window.requestAnimationFrame(resetScroll)
    const timeoutId = window.setTimeout(resetScroll, 0)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.clearTimeout(timeoutId)
      window.history.scrollRestoration = previousScrollRestoration
    }
  }, [])

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <Header />
      <main className="flex-1">
        <HeroSection />
        <StepsSection />
        <TrustSection />
        <FaqSection />
      </main>
      <SiteFooter />
      <MobileCta />
    </div>
  )
}
