import type { ReactNode } from 'react'
import { NightBackdrop } from './NightBackdrop.tsx'
import { CONTAINER, LEAD, SECTION_TITLE } from './sectionStyles.ts'

interface SafetyAction {
  readonly name: string
  readonly text: string
  readonly icon: ReactNode
}

const ACTIONS: readonly SafetyAction[] = [
  {
    name: 'Sair',
    text: 'Encerre a partida quando quiser, sem precisar explicar.',
    icon: <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" />,
  },
  {
    name: 'Bloquear',
    text: 'Quem você bloqueia não cruza mais com você.',
    icon: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="m6.5 6.5 11 11" />
      </>
    ),
  },
  {
    name: 'Denunciar',
    text: 'Conte o que aconteceu direto da partida, sem sair procurando onde.',
    icon: <path d="M5 21V4m0 0h11l-2 4 2 4H5" />,
  },
]

export const SAFETY_ANCHOR = 'seguranca'

/**
 * Cartão noturno, como o do minijogo: a porta entreaberta à direita da foto, o texto à esquerda. Fica dentro da
 * faixa do tema para separar as seções noturnas de página inteira (hero, perguntas, chamada final).
 */
export function SafetySection() {
  return (
    <section id={SAFETY_ANCHOR} aria-labelledby="safety-title" className="scroll-mt-16 pb-24 md:pb-32">
      <div className={CONTAINER}>
        <div className="candlelight relative isolate overflow-hidden rounded-lg scheme-dark">
          <NightBackdrop
            wideSrc="/backgrounds/safety.webp"
            isAboveTheFold={false}
            imageClassName="object-right"
            scrimClassName="bg-canvas/70 md:bg-linear-to-r md:from-canvas/70 md:via-canvas/60 md:to-canvas/40"
          />
          <div className="flex max-w-xl flex-col gap-12 px-6 py-16 md:px-16 md:py-24">
            <div className="flex flex-col gap-4">
              <h2 id="safety-title" className={SECTION_TITLE}>
                Você sai quando quiser
              </h2>
              <p className={LEAD}>
                Segurança não fica escondida num menu. Os três botões ficam à vista durante a partida inteira.
              </p>
            </div>
            <ul className="flex flex-col gap-8">
              {ACTIONS.map((action) => (
                <li key={action.name} className="flex gap-4">
                  <svg
                    viewBox="0 0 24 24"
                    className="mt-1 size-6 shrink-0 text-fg-accent"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {action.icon}
                  </svg>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-semibold text-fg">{action.name}</h3>
                    <p className="leading-relaxed text-fg-muted">{action.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
