"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { HeroSection } from "@/components/hero-section";
import { StepsSection } from "@/components/steps-section"
import { TrustSection } from "@/components/trust-section"
import { FaqSection } from "@/components/faq-section"
import { SiteFooter } from "@/components/site-footer"
import { MobileCta } from "@/components/mobile-cta"
import { MiniMifOverlay } from "@/components/mini-mif-overlay"

export default function HomePage() {
  const [miniMifOpen, setMiniMifOpen] = useState(false)
  const [miniMifValue, setMiniMifValue] = useState("")

  return (
    <div className="flex min-h-screen flex-col overflow-x-visible">
      <Header />
      <main className="flex-1">
        <HeroSection
          onOpenMiniMif={(initialValue) => {
            setMiniMifValue(initialValue ?? "")
            setMiniMifOpen(true)
          }}
        />
        <StepsSection />
        <TrustSection />
        <FaqSection />
      </main>
      <SiteFooter />
      <MobileCta />
      <MiniMifOverlay
        open={miniMifOpen}
        initialValue={miniMifValue}
        onOpenChange={setMiniMifOpen}
      />
    </div>
  )
}
