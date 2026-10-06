import { NightBackdrop } from './NightBackdrop.tsx'
import { CONTAINER, SECTION_SPACING, SECTION_TITLE } from './sectionStyles.ts'

const QUESTIONS = [
  {
    question: 'O que é o Duora?',
    answer:
      'Um app de encontros para adultos em que o primeiro contato é uma partida curta a dois, e não uma conversa começando do zero.',
  },
  {
    question: 'Por que jogar antes de conversar?',
    answer:
      'Porque é mais fácil começar rindo de um desenho torto do que inventando a primeira frase. O jogo dá assunto e tira o peso do primeiro contato.',
  },
  {
    question: 'Preciso jogar bem?',
    answer: 'Não. As partidas são curtas e ninguém está ali para ganhar.',
  },
  {
    question: 'Os jogos da frase lá em cima são os de verdade?',
    answer: 'São exemplos. A lista de jogos ainda está em teste e pode mudar até a abertura.',
  },
  {
    question: 'Quando abre? E o que acontece com meu e-mail?',
    answer: 'Ainda não há data. O e-mail fica na lista de espera e serve para avisar você quando o Duora abrir.',
  },
] as const

export const FAQ_ANCHOR = 'perguntas'

/** Noturna: as cartas de pergunta ficam à esquerda da foto, as respostas à direita, sobre o véu mais forte. */
export function FaqSection() {
  return (
    <section
      id={FAQ_ANCHOR}
      aria-labelledby="faq-title"
      className={`${SECTION_SPACING} candlelight relative isolate scroll-mt-16 overflow-hidden scheme-dark`}
    >
      <NightBackdrop
        wideSrc="/backgrounds/faq.webp"
        isAboveTheFold={false}
        imageClassName="object-left"
        scrimClassName="bg-canvas/70 md:bg-linear-to-l md:from-canvas/70 md:via-canvas/65 md:to-canvas/40"
      />
      <div className={`${CONTAINER} grid gap-12 md:grid-cols-3 md:gap-16`}>
        <h2 id="faq-title" className={SECTION_TITLE}>
          Perguntas
        </h2>
        <div className="border-t border-divider md:col-span-2">
          {QUESTIONS.map(({ question, answer }) => (
            <details key={question} className="group border-b border-divider">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-6 text-lg font-semibold text-fg [&::-webkit-details-marker]:hidden">
                {question}
                <svg
                  viewBox="0 0 24 24"
                  className="size-6 shrink-0 text-fg-muted transition-transform duration-200 group-open:rotate-45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </summary>
              <p className="max-w-prose pb-6 leading-relaxed text-fg-muted">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
