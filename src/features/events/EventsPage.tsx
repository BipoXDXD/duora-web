import { useState } from 'react'
import { AppLink } from '../../shared/routing/AppLink.tsx'
import { PATHS } from '../../shared/routing/routes.ts'
import { LoadFailure } from '../../shared/ui/LoadFailure.tsx'
import { LoadMore } from '../../shared/ui/LoadMore.tsx'
import { PageFrame } from '../../shared/ui/PageFrame.tsx'
import { TEXT_LINK } from '../../shared/ui/styles.ts'
import { RequireSession } from '../auth/RequireSession.tsx'
import { EventCard } from './EventCard.tsx'
import { EVENT_KEYS, usePagedList } from './eventQueries.ts'
import { eventPhaseAt, fetchEventsPage } from './events.ts'

/** "Eventos": os publicados que ainda vão começar, do mais próximo ao mais distante. */
export function EventsPage() {
  return (
    <PageFrame title="Eventos">
      <RequireSession signInMessage="Entre para ver os próximos eventos.">
        <AppLink to={PATHS.registrations} className={TEXT_LINK}>
          Minhas inscrições
        </AppLink>
        <EventsList />
      </RequireSession>
    </PageFrame>
  )
}

function EventsList() {
  const list = usePagedList(EVENT_KEYS.list, fetchEventsPage)
  const [now] = useState(() => new Date())

  if (list.items === undefined) {
    return list.hasFailed ? (
      <LoadFailure message="Não foi possível carregar os eventos." onRetry={list.retry} />
    ) : (
      <p role="status" className="text-fg-muted">
        Carregando os eventos…
      </p>
    )
  }

  const hasNoEvents = list.items.length === 0 && !list.loadMore.hasNextPage
  return (
    <div className="flex flex-col items-start gap-6">
      {hasNoEvents ? (
        <div className="flex flex-col gap-2">
          <p className="text-lg font-semibold text-fg">Nenhum evento marcado por enquanto.</p>
          <p className="text-fg-muted">Os próximos eventos aparecem aqui assim que forem publicados.</p>
        </div>
      ) : (
        <ul aria-label="Próximos eventos" className="flex w-full flex-col gap-4">
          {list.items.map((event) => (
            <EventCard
              key={event.id}
              eventId={event.id}
              title={event.title}
              startsAt={event.startsAt}
              endsAt={event.endsAt}
              phase={eventPhaseAt(event, now)}
            >
              <p className="line-clamp-2 text-fg">{event.description}</p>
            </EventCard>
          ))}
        </ul>
      )}
      <LoadMore {...list.loadMore} />
    </div>
  )
}
