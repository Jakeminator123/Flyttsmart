import { Header } from "@/components/header"
import { HeroSection } from "@/components/hero-section"
import { ValuePropositionSection } from "@/components/value-proposition-section"
import { StepsSection } from "@/components/steps-section"
import { BenefitsSection } from "@/components/benefits-section"
import { ComparisonSection } from "@/components/comparison-section"
import { TestimonialsSection } from "@/components/testimonials-section"
import { TrustSection } from "@/components/trust-section"
import { FaqSection } from "@/components/faq-section"
import { CtaSection } from "@/components/cta-section"
import { SiteFooter } from "@/components/site-footer"
import { MobileCta } from "@/components/mobile-cta"

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <Header />
      <main className="flex-1">
        <HeroSection />
        <ValuePropositionSection />
        <StepsSection />
        <BenefitsSection />
        <ComparisonSection />
        <TestimonialsSection />
        <TrustSection />
        <FaqSection />
        <CtaSection />
      </main>
      <SiteFooter />
      <MobileCta />
    </div>
  )
}
