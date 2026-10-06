import { JoinWaitlistForm } from '../waitlist/JoinWaitlistForm.tsx'
import { HeroInvitation } from './HeroInvitation.tsx'
import { NightBackdrop } from './NightBackdrop.tsx'
import { CONTAINER } from './sectionStyles.ts'

export const WAITLIST_ANCHOR = 'lista'

/** Sempre noturno (`scheme-dark`), nos dois temas: a mesa posta à luz de vela. */
export function HeroSection() {
  return (
    <section aria-labelledby="hero-title" className="candlelight relative isolate overflow-hidden scheme-dark">
      <NightBackdrop
        wideSrc="/backgrounds/hero.webp"
        narrowSrc="/backgrounds/hero-mobile.webp"
        isAboveTheFold
        imageClassName="object-bottom md:object-right"
        scrimClassName="bg-linear-to-b from-canvas/70 via-canvas/70 via-75% to-canvas/40 md:via-50% md:bg-linear-to-r md:from-canvas/70 md:via-canvas/50 md:to-canvas/40"
      />
      <div className={`${CONTAINER} flex flex-col gap-12 pt-16 pb-48 md:py-32`}>
        <HeroInvitation titleId="hero-title" />
        <div id={WAITLIST_ANCHOR} className="flex scroll-mt-24 flex-col gap-6">
          <p className="max-w-xl text-lg leading-relaxed text-fg md:text-xl">
            Antes de conversar, jogue. Uma partida curta a dois diz mais do que uma bio, e dá menos medo.
          </p>
          <JoinWaitlistForm />
          <p className="text-sm text-fg">O Duora ainda não abriu. Avisamos por e-mail quando abrir.</p>
        </div>
      </div>
    </section>
  )
}
