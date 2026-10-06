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

const FAQ_IMAGE_SIZE = { width: 1920, height: 1080 } as const

export const FAQ_ANCHOR = 'perguntas'

export function FaqSection() {
  return (
    <section id={FAQ_ANCHOR} aria-labelledby="faq-title" className={`${SECTION_SPACING} scroll-mt-16`}>
      <div className={`${CONTAINER} grid gap-12 md:grid-cols-3 md:gap-16`}>
        <div className="flex flex-col gap-8">
          <h2 id="faq-title" className={SECTION_TITLE}>
            Perguntas
          </h2>
          {/* Só no desktop, onde a coluna do título sobra; decorativa, por isso alt vazio. */}
          <img
            src="/backgrounds/faq.webp"
            alt=""
            width={FAQ_IMAGE_SIZE.width}
            height={FAQ_IMAGE_SIZE.height}
            loading="lazy"
            decoding="async"
            className="hidden aspect-4/5 w-full rounded-lg bg-surface object-cover object-right md:block"
          />
        </div>
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
