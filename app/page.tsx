import { Header } from "@/components/header";
import { HeroSection } from "@/components/hero-section";
import { StepsSection } from "@/components/steps-section"
import { TrustSection } from "@/components/trust-section"
import { FaqSection } from "@/components/faq-section"
import { CtaSection } from "@/components/cta-section"
import { SiteFooter } from "@/components/site-footer"
import { MobileCta } from "@/components/mobile-cta"
import { OpenClawChatWidget } from "@/components/openclaw-chat-widget"

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <Header />
      <main className="flex-1">
        <HeroSection />
        <StepsSection />
        <TrustSection />
        <FaqSection />
        <CtaSection />
      </main>
      <SiteFooter />
      <MobileCta />
      <OpenClawChatWidget formType="home" />
    </div>
  )
}
