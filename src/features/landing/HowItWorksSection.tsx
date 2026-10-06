import { CONTAINER, LEAD, SECTION_SPACING, SECTION_TITLE } from './sectionStyles.ts'

const STEPS = [
  {
    image: '/images/step1-match.webp',
    alt: 'Duas chaves antigas lado a lado sobre veludo ameixa, à luz de vela',
    title: 'Combinamos vocês dois',
    text: 'O Duora junta você e outra pessoa para uma partida curta. Sem rolar perfis até cansar.',
  },
  {
    image: '/images/step2-play.webp',
    alt: 'Tabuleiro de madeira com dados e peças em damasco e rosa, à luz de vela',
    title: 'Vocês jogam',
    text: 'Alguns minutos do mesmo lado da mesa. Ninguém precisa ser bom nisso; rir já conta ponto.',
  },
  {
    image: '/images/step3-talk.webp',
    alt: 'Duas xícaras fumegantes frente a frente, com um bilhete entre elas',
    title: 'Depois, se quiserem, conversam',
    text: 'A conversa vem depois do jogo, não antes. Aí já existe assunto.',
  },
] as const

/** Retratos 4:5 gerados para cada passo; largura e altura evitam o salto de layout ao carregar. */
const STEP_IMAGE_SIZE = { width: 800, height: 1000 } as const

export const HOW_IT_WORKS_ANCHOR = 'como-funciona'

export function HowItWorksSection() {
  return (
    <section id={HOW_IT_WORKS_ANCHOR} aria-labelledby="how-title" className={`${SECTION_SPACING} scroll-mt-16`}>
      <div className={`${CONTAINER} flex flex-col gap-16`}>
        <div className="flex max-w-2xl flex-col gap-4">
          <h2 id="how-title" className={SECTION_TITLE}>
            Como funciona
          </h2>
          <p className={LEAD}>Três passos, nessa ordem. O jogo vem primeiro de propósito.</p>
        </div>
        <ol className="grid gap-12 md:grid-cols-3 md:gap-8">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex flex-col gap-6">
              <img
                src={step.image}
                alt={step.alt}
                width={STEP_IMAGE_SIZE.width}
                height={STEP_IMAGE_SIZE.height}
                loading="lazy"
                decoding="async"
                className="aspect-4/3 w-full rounded-lg bg-surface object-cover md:aspect-4/5"
              />
              <div className="flex flex-col gap-3">
                <span aria-hidden="true" className="font-display text-5xl leading-none font-medium text-fg-accent">
                  {index + 1}
                </span>
                <h3 className="text-xl font-semibold text-fg">{step.title}</h3>
                <p className="leading-relaxed text-fg-muted">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
