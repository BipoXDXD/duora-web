import { useEffect, useState, useSyncExternalStore } from 'react'

/** Exemplos de partida, não o catálogo final; a FAQ diz isso. */
const GAMES = ['adivinha o desenho', 'quiz a dois', 'palavra secreta', 'duas verdades, uma mentira'] as const
const PEOPLE = [
  'quem você ainda não conhece',
  'alguém da sua cidade',
  'quem ri das mesmas coisas',
  'alguém curioso como você',
] as const

const ROTATION_MS = 3500
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function subscribeToMotion(onChange: () => void): () => void {
  const media = window.matchMedia(REDUCED_MOTION_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function prefersReducedMotion(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

function sentenceAt(index: number): { readonly game: string; readonly person: string } {
  return { game: GAMES[index % GAMES.length] ?? '', person: PEOPLE[index % PEOPLE.length] ?? '' }
}

interface HeroInvitationProps {
  readonly titleId: string
}

/**
 * O título do hero: um convite com duas lacunas (o jogo e a pessoa) que trocam sozinhas. Como a troca é
 * automática e dura mais de 5 s, há botão de pausa (WCAG 2.2.2); com movimento reduzido ela começa parada.
 * A troca automática não é anunciada; a pedida ("Outra combinação") é, numa região `polite`.
 */
export function HeroInvitation({ titleId }: HeroInvitationProps) {
  const [index, setIndex] = useState(0)
  const [announcement, setAnnouncement] = useState('')
  const [pausedByVisitor, setPausedByVisitor] = useState<boolean | null>(null)
  const reducedMotion = useSyncExternalStore(subscribeToMotion, prefersReducedMotion)
  const isPaused = pausedByVisitor ?? reducedMotion

  useEffect(() => {
    if (isPaused) {
      return undefined
    }
    const timer = window.setInterval(() => setIndex((current) => current + 1), ROTATION_MS)
    return () => window.clearInterval(timer)
  }, [isPaused])

  function showAnother() {
    const next = index + 1
    const { game, person } = sentenceAt(next)
    setIndex(next)
    setAnnouncement(`vamos jogar ${game} com ${person}`)
  }

  const { game, person } = sentenceAt(index)

  return (
    <div className="flex flex-col gap-6">
      <h1
        id={titleId}
        className="max-w-4xl font-display text-4xl leading-tight font-medium tracking-tight text-balance text-fg min-h-45 sm:text-5xl md:min-h-68 md:text-7xl"
      >
        vamos jogar{' '}
        <span key={`game-${index}`} className={`${SLOT_CLASS} text-primary decoration-primary`}>
          {game}
        </span>{' '}
        com{' '}
        <span key={`person-${index}`} className={`${SLOT_CLASS} text-accent decoration-accent`}>
          {person}
        </span>
      </h1>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={showAnother} className={CONTROL_CLASS}>
          <ShuffleIcon />
          Outra combinação
        </button>
        <button type="button" onClick={() => setPausedByVisitor(!isPaused)} className={CONTROL_CLASS}>
          {isPaused ? <PlayIcon /> : <PauseIcon />}
          {isPaused ? 'Retomar a frase' : 'Pausar a frase'}
        </button>
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  )
}

/** Lacuna de convite para preencher: sublinhado tracejado, que entra com um desfoque curto ao trocar. */
const SLOT_CLASS = 'underline decoration-dashed decoration-2 underline-offset-8 motion-safe:animate-slot-in'

const CONTROL_CLASS =
  'inline-flex min-h-11 min-w-11 items-center gap-2 rounded-lg border border-edge px-3 text-sm font-semibold text-fg-muted hover:border-fg-muted hover:text-fg'

function ShuffleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 7h3.5c4 0 6.5 10 11 10H21M18 14l3 3-3 3M3 17h3.5c1.6 0 2.9-1.6 4-3.5M18 4l3 3-3 3M21 7h-3.5c-1.6 0-2.9 1.6-4 3.5"
      />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
      <path d="M7 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.8L8.5 4.6A1 1 0 0 0 7 5.5Z" />
    </svg>
  )
}
