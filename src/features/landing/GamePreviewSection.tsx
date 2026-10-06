import { NightBackdrop } from './NightBackdrop.tsx'
import { CONTAINER } from './sectionStyles.ts'

/** O minijogo de 20 s ainda não existe; o bloco diz isso em vez de prometer o que não está pronto. */
export function GamePreviewSection() {
  return (
    <section aria-labelledby="preview-title" className="pb-24 md:pb-32">
      <div className={CONTAINER}>
        <div className="candlelight relative isolate overflow-hidden rounded-lg scheme-dark">
          <NightBackdrop
            wideSrc="/backgrounds/minigame.webp"
            isAboveTheFold={false}
            imageClassName="object-left"
            scrimClassName="bg-canvas/70 md:bg-linear-to-l md:from-canvas/70 md:via-canvas/60 md:to-canvas/40"
          />
          <div className="flex max-w-xl flex-col items-start gap-4 px-6 py-16 md:ml-auto md:px-16 md:py-24">
            <p className="rounded-lg border border-primary bg-primary-subtle px-3 py-1 text-sm font-semibold text-on-primary-subtle">
              Em breve
            </p>
            <h2
              id="preview-title"
              className="font-display text-3xl leading-tight font-medium tracking-tight text-balance text-fg md:text-4xl"
            >
              Uma partida de 20 segundos, aqui mesmo
            </h2>
            <p className="text-lg leading-relaxed text-fg-muted">
              Estamos montando uma rodada curta para você jogar nesta página e sentir como é. Ela ainda não está pronta;
              quando estiver, aparece aqui.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
