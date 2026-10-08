import { useState } from 'react'
import { AppLink } from '../../shared/routing/AppLink.tsx'
import { PATHS } from '../../shared/routing/routes.ts'
import { LoadFailure } from '../../shared/ui/LoadFailure.tsx'
import { LoadMore } from '../../shared/ui/LoadMore.tsx'
import { PageFrame } from '../../shared/ui/PageFrame.tsx'
import { PRIMARY_BUTTON, TEXT_LINK } from '../../shared/ui/styles.ts'
import { RequireSession } from '../auth/RequireSession.tsx'
import { EventCard } from './EventCard.tsx'
import { EVENT_KEYS, usePagedList } from './eventQueries.ts'
import { eventPhaseAt } from './events.ts'
import { formatDay } from './eventText.ts'
import { fetchMyRegistrationsPage } from './registrations.ts'

/** "Minhas inscrições": eventos que ainda não acabaram, inclusive cancelados e em andamento. */
export function MyRegistrationsPage() {
  return (
    <PageFrame title="Minhas inscrições">
      <RequireSession signInMessage="Entre para ver suas inscrições.">
        <MyRegistrationsList />
        <AppLink to={PATHS.events} className={TEXT_LINK}>
          Ver todos os eventos
        </AppLink>
      </RequireSession>
    </PageFrame>
  )
}

function MyRegistrationsList() {
  const list = usePagedList(EVENT_KEYS.myRegistrations, fetchMyRegistrationsPage)
  const [now] = useState(() => new Date())

  if (list.items === undefined) {
    return list.hasFailed ? (
      <LoadFailure message="Não foi possível carregar suas inscrições." onRetry={list.retry} />
    ) : (
      <p role="status" className="text-fg-muted">
        Carregando suas inscrições…
      </p>
    )
  }

  const hasNoRegistrations = list.items.length === 0 && !list.loadMore.hasNextPage
  return (
    <div className="flex flex-col items-start gap-6">
      {hasNoRegistrations ? (
        <div className="flex flex-col items-start gap-4">
          <p className="text-lg font-semibold text-fg">Você não tem inscrições em eventos futuros.</p>
          <AppLink to={PATHS.events} className={PRIMARY_BUTTON}>
            Escolher um evento
          </AppLink>
        </div>
      ) : (
        <ul aria-label="Suas inscrições" className="flex w-full flex-col gap-4">
          {list.items.map((registration) => (
            <EventCard
              key={registration.eventId}
              eventId={registration.eventId}
              title={registration.title}
              startsAt={registration.startsAt}
              endsAt={registration.endsAt}
              phase={eventPhaseAt({ ...registration, status: registration.eventStatus }, now)}
            >
              <p className="text-sm text-fg-muted">{`Inscrição feita em ${formatDay(registration.registeredAt)}`}</p>
            </EventCard>
          ))}
        </ul>
      )}
      <LoadMore {...list.loadMore} />
    </div>
  )
}
