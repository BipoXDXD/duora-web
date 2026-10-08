import type { ReactNode } from 'react'
import { AppLink } from '../../shared/routing/AppLink.tsx'
import { eventPath } from '../../shared/routing/routes.ts'
import type { EventPhase } from './events.ts'
import { formatEventTime } from './eventText.ts'
import { PhaseBadge } from './PhaseBadge.tsx'

interface EventCardProps {
  readonly eventId: string
  readonly title: string
  readonly startsAt: Date
  readonly endsAt: Date
  readonly phase: EventPhase
  /** Texto extra abaixo do horário, como o começo da descrição. */
  readonly children?: ReactNode
}

/** Um evento numa lista: o título leva ao evento. */
export function EventCard({ eventId, title, startsAt, endsAt, phase, children }: EventCardProps) {
  return (
    <li className="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-raised">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <AppLink
          to={eventPath(eventId)}
          className="inline-flex min-h-11 min-w-11 items-center font-display text-xl font-medium text-fg underline-offset-4 hover:underline"
        >
          {title}
        </AppLink>
        <PhaseBadge phase={phase} />
      </div>
      <p className="text-fg-muted">{formatEventTime(startsAt, endsAt)}</p>
      {children}
    </li>
  )
}
