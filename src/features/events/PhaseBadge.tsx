import type { EventPhase } from './events.ts'
import { PHASE_LABELS } from './eventText.ts'

const BADGE_CLASS: Readonly<Record<EventPhase, string>> = {
  upcoming: '',
  inProgress: 'bg-primary-subtle text-on-primary-subtle',
  ended: 'border border-edge text-fg-muted',
  cancelled: 'border border-edge text-danger',
}

/** A fase do evento em texto, nunca só em cor. O evento que ainda vai começar fica sem etiqueta. */
export function PhaseBadge({ phase }: { readonly phase: EventPhase }) {
  const label = PHASE_LABELS[phase]
  if (label === null) {
    return null
  }
  return (
    <span className={`rounded-full px-3 py-1 text-sm font-semibold tracking-wide ${BADGE_CLASS[phase]}`}>{label}</span>
  )
}
