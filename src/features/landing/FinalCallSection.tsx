import { WAITLIST_ANCHOR } from './HeroSection.tsx'
import { NightBackdrop } from './NightBackdrop.tsx'
import { CONTAINER, PRIMARY_LINK } from './sectionStyles.ts'

/** Os dois cavalos de frente: duas pessoas que se encontram. Sempre noturna, como o hero. */
export function FinalCallSection() {
  return (
    <section aria-labelledby="final-title" className="candlelight relative isolate overflow-hidden scheme-dark">
      <NightBackdrop
        wideSrc="/backgrounds/table.webp"
        narrowSrc="/backgrounds/table-mobile.webp"
        isAboveTheFold={false}
        imageClassName="object-bottom md:object-center"
        scrimClassName="bg-linear-to-b from-canvas/70 via-canvas/50 to-canvas/40 md:bg-linear-to-r md:from-canvas/70 md:to-canvas/40"
      />
      <div className={`${CONTAINER} flex flex-col items-start gap-6 pt-24 pb-96 md:py-32`}>
        <h2
          id="final-title"
          className="max-w-xl font-display text-4xl leading-tight font-medium tracking-tight text-balance text-fg md:text-6xl"
        >
          Guarde seu lugar à mesa
        </h2>
        <p className="max-w-md text-lg leading-relaxed text-fg-muted">
          Deixe o e-mail e avisamos quando a primeira partida estiver pronta.
        </p>
        <a href={`#${WAITLIST_ANCHOR}`} className={PRIMARY_LINK}>
          Entrar na lista
        </a>
      </div>
    </section>
  )
}
