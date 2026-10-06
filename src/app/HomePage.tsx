import { FaqSection } from '../features/landing/FaqSection.tsx'
import { FinalCallSection } from '../features/landing/FinalCallSection.tsx'
import { GamePreviewSection } from '../features/landing/GamePreviewSection.tsx'
import { HeroSection } from '../features/landing/HeroSection.tsx'
import { HowItWorksSection } from '../features/landing/HowItWorksSection.tsx'
import { SafetySection } from '../features/landing/SafetySection.tsx'
import { SiteFooter } from '../features/landing/SiteFooter.tsx'

/** A landing da lista de espera, na ordem do docs/design-research.md (direção A). */
export function HomePage() {
  return (
    <>
      <HeroSection />
      <HowItWorksSection />
      <GamePreviewSection />
      <SafetySection />
      <FaqSection />
      <FinalCallSection />
      <SiteFooter />
    </>
  )
}
