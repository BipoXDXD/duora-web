import { useQuery } from '@tanstack/react-query'
import { AppLink } from '../../shared/routing/AppLink.tsx'
import { PATHS } from '../../shared/routing/routes.ts'
import { LoadFailure } from '../../shared/ui/LoadFailure.tsx'
import { PageFrame } from '../../shared/ui/PageFrame.tsx'
import { TEXT_LINK } from '../../shared/ui/styles.ts'
import { RequireSession } from '../auth/RequireSession.tsx'
import { useSession } from '../auth/useSession.ts'
import { EVENT_KEYS, READ_OPTIONS } from './eventQueries.ts'
import { eventPhaseAt, fetchEvent, type EventPhase, type SocialEvent } from './events.ts'
import { formatEventTime } from './eventText.ts'
import { PairingPanel } from './PairingPanel.tsx'
import { PhaseBadge } from './PhaseBadge.tsx'
import { RegistrationPanel } from './RegistrationPanel.tsx'
import { fetchRegistration } from './registrations.ts'

const GENERIC_TITLE = 'Evento'

interface EventPageProps {
  readonly eventId: string
}

/** Um evento: quando e o quê, a inscrição e, com o evento em andamento, a dupla de cada rodada. */
export function EventPage({ eventId }: EventPageProps) {
  const session = useSession()
  if (session.kind === 'authenticated') {
    return <EventDetails eventId={eventId} />
  }
  return (
    <PageFrame title={GENERIC_TITLE}>
      <RequireSession signInMessage="Entre para ver este evento.">{null}</RequireSession>
    </PageFrame>
  )
}

/**
 * A moldura muda de chave quando o evento chega: o título vira o do evento e recebe o foco, para o leitor
 * de tela anunciá-lo.
 */
function EventDetails({ eventId }: EventPageProps) {
  const query = useQuery({ queryKey: EVENT_KEYS.event(eventId), queryFn: () => fetchEvent(eventId), ...READ_OPTIONS })

  if (query.data === undefined) {
    return (
      <PageFrame key="loading" title={GENERIC_TITLE}>
        {query.isError ? (
          <LoadFailure message="Não foi possível carregar o evento." onRetry={() => void query.refetch()} />
        ) : (
          <p role="status" className="text-fg-muted">
            Carregando o evento…
          </p>
        )}
      </PageFrame>
    )
  }
  if (query.data === null) {
    return (
      <PageFrame key="notFound" title="Evento não encontrado">
        <p className="text-lg text-fg-muted">O evento não existe ou não está mais publicado.</p>
        <BackToEvents />
      </PageFrame>
    )
  }
  // A fase vale para o instante da leitura: reler o evento (depois de um 409, por exemplo) a atualiza.
  const phase = eventPhaseAt(query.data, new Date(query.dataUpdatedAt))
  return (
    <PageFrame key="event" title={query.data.title}>
      <EventSummary event={query.data} phase={phase} />
      <EventParticipation eventId={eventId} phase={phase} />
      <BackToEvents />
    </PageFrame>
  )
}

function EventSummary({ event, phase }: { readonly event: SocialEvent; readonly phase: EventPhase }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <PhaseBadge phase={phase} />
      <p className="text-lg font-semibold text-fg">{formatEventTime(event.startsAt, event.endsAt)}</p>
      <p className="whitespace-pre-line text-fg">{event.description}</p>
    </div>
  )
}

function EventParticipation({ eventId, phase }: { readonly eventId: string; readonly phase: EventPhase }) {
  switch (phase) {
    case 'upcoming':
      return <RegistrationPanel eventId={eventId} />
    case 'inProgress':
      return <InProgress eventId={eventId} />
    case 'ended':
      return <p className="text-lg text-fg">Este evento já terminou.</p>
    case 'cancelled':
      return <p className="text-lg text-fg">Este evento foi cancelado.</p>
  }
}

/** Com o evento em andamento, só quem está inscrito tem dupla; as inscrições já fecharam. */
function InProgress({ eventId }: { readonly eventId: string }) {
  const query = useQuery({
    queryKey: EVENT_KEYS.registration(eventId),
    queryFn: () => fetchRegistration(eventId),
    ...READ_OPTIONS,
  })
  if (query.data === undefined) {
    return query.isError ? (
      <LoadFailure message="Não foi possível verificar sua inscrição." onRetry={() => void query.refetch()} />
    ) : (
      <p role="status" className="text-fg-muted">
        Verificando sua inscrição…
      </p>
    )
  }
  if (query.data === null) {
    return <p className="text-lg text-fg">O evento já começou, e as inscrições estão fechadas.</p>
  }
  return <PairingPanel eventId={eventId} />
}

function BackToEvents() {
  return (
    <AppLink to={PATHS.events} className={TEXT_LINK}>
      Ver todos os eventos
    </AppLink>
  )
}
