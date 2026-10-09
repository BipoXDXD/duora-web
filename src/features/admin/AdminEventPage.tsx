import { useQuery } from '@tanstack/react-query'
import { AppLink } from '../../shared/routing/AppLink.tsx'
import { eventPath } from '../../shared/routing/routes.ts'
import { LoadFailure } from '../../shared/ui/LoadFailure.tsx'
import { PageFrame } from '../../shared/ui/PageFrame.tsx'
import { SECONDARY_BUTTON, TEXT_LINK } from '../../shared/ui/styles.ts'
import { LOGIN_URL } from '../auth/loginUrl.ts'
import { RequireSession } from '../auth/RequireSession.tsx'
import { useSession } from '../auth/useSession.ts'
import { READ_OPTIONS } from '../events/eventQueries.ts'
import { formatEventTime } from '../events/eventText.ts'
import { AdminEventActions } from './AdminEventActions.tsx'
import { adminPhaseAt, fetchAdminEvent, type AdminEvent, type AdminPhase } from './adminEvents.ts'
import { ADMIN_KEYS } from './adminQueries.ts'
import { ADMIN_PHASE_LABELS, STAFF_ONLY_TEXT } from './adminText.ts'
import { AdminRoundsPanel } from './AdminRoundsPanel.tsx'

const GENERIC_TITLE = 'Evento'

interface AdminEventPageProps {
  readonly eventId: string
}

/**
 * O evento visto pela equipe: estado guardado, inscritos, publicar, cancelar e as rodadas. O front não sabe
 * quem é ADMIN: a API responde 403 a quem não é, e a página só mostra isso.
 */
export function AdminEventPage({ eventId }: AdminEventPageProps) {
  const session = useSession()
  if (session.kind === 'authenticated') {
    return <AdminEventDetails eventId={eventId} />
  }
  return (
    <PageFrame title={GENERIC_TITLE}>
      <RequireSession signInMessage="Entre para ver este evento.">{null}</RequireSession>
    </PageFrame>
  )
}

/** A moldura muda de chave a cada estado: o título vira o do evento (ou o do aviso) e recebe o foco. */
function AdminEventDetails({ eventId }: AdminEventPageProps) {
  const query = useQuery({
    queryKey: ADMIN_KEYS.event(eventId),
    queryFn: () => fetchAdminEvent(eventId),
    ...READ_OPTIONS,
  })
  const result = query.data

  if (result === undefined) {
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
  switch (result.kind) {
    case 'found': {
      // A fase vale para o instante da leitura: reler o evento (o botão "Atualizar", um 409) a atualiza.
      const now = new Date(query.dataUpdatedAt)
      const phase = adminPhaseAt(result.event, now)
      return (
        <PageFrame key="event" title={result.event.title}>
          <EventSummary
            event={result.event}
            phase={phase}
            isRefreshing={query.isFetching}
            onRefresh={() => void query.refetch()}
          />
          <AdminEventActions event={result.event} now={now} />
          <AdminRoundsPanel event={result.event} phase={phase} />
        </PageFrame>
      )
    }
    case 'forbidden':
      return (
        <PageFrame key="forbidden" title="Área da equipe">
          <p role="alert" className="text-lg text-fg">
            {STAFF_ONLY_TEXT}
          </p>
        </PageFrame>
      )
    case 'notFound':
      return (
        <PageFrame key="notFound" title="Evento não encontrado">
          <p className="text-lg text-fg-muted">Não há evento com este endereço.</p>
        </PageFrame>
      )
    case 'signedOut':
      return (
        <PageFrame key="signedOut" title={GENERIC_TITLE}>
          <div className="flex flex-col items-start gap-4">
            <p role="alert" className="text-fg">
              Sua sessão terminou. Entre de novo para continuar.
            </p>
            <a href={LOGIN_URL} className={SECONDARY_BUTTON}>
              Entrar de novo
            </a>
          </div>
        </PageFrame>
      )
    case 'failed':
      return (
        <PageFrame key="failed" title={GENERIC_TITLE}>
          <LoadFailure message="Não foi possível carregar o evento." onRetry={() => void query.refetch()} />
        </PageFrame>
      )
  }
}

interface EventSummaryProps {
  readonly event: AdminEvent
  readonly phase: AdminPhase
  readonly isRefreshing: boolean
  readonly onRefresh: () => void
}

function EventSummary({ event, phase, isRefreshing, onRefresh }: EventSummaryProps) {
  return (
    <section aria-label="Resumo do evento" className="flex flex-col items-start gap-4">
      <span className="rounded-full border border-edge px-3 py-1 text-sm font-semibold tracking-wide text-fg">
        {ADMIN_PHASE_LABELS[phase]}
      </span>
      <p className="text-lg font-semibold text-fg">{formatEventTime(event.startsAt, event.endsAt)}</p>
      <p className="whitespace-pre-line text-fg">{event.description}</p>
      <p className="text-fg">{registrationText(event)}</p>
      {phase === 'draft' && (
        <p className="text-fg-muted">Este evento é um rascunho: só a equipe o vê até ele ser publicado.</p>
      )}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <button type="button" onClick={onRefresh} disabled={isRefreshing} className={SECONDARY_BUTTON}>
          {isRefreshing ? 'Atualizando…' : 'Atualizar'}
        </button>
        {event.status !== 'DRAFT' && (
          <AppLink to={eventPath(event.id)} className={TEXT_LINK}>
            Ver como participante
          </AppLink>
        )}
      </div>
    </section>
  )
}

/** "3 pessoas inscritas de 40 vagas.": só a contagem, a API nunca diz quem. */
function registrationText(event: Pick<AdminEvent, 'registrationCount' | 'capacity'>): string {
  const count = event.registrationCount
  const people = count === 1 ? '1 pessoa inscrita' : `${count} pessoas inscritas`
  return `${people} de ${event.capacity} vagas.`
}
