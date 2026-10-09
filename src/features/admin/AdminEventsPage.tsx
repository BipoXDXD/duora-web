import { useId, useState } from 'react'
import { usePagedList } from '../../shared/api/usePagedList.ts'
import { AppLink } from '../../shared/routing/AppLink.tsx'
import { adminEventPath, PATHS } from '../../shared/routing/routes.ts'
import { LoadFailure } from '../../shared/ui/LoadFailure.tsx'
import { LoadMore } from '../../shared/ui/LoadMore.tsx'
import { PageFrame } from '../../shared/ui/PageFrame.tsx'
import { FIELD_CONTROL, PRIMARY_BUTTON } from '../../shared/ui/styles.ts'
import { RequireSession } from '../auth/RequireSession.tsx'
import { formatEventTime } from '../events/eventText.ts'
import {
  ADMIN_EVENT_STATUSES,
  adminFailureOf,
  adminPhaseAt,
  fetchAdminEventsPage,
  type AdminEvent,
  type AdminEventStatus,
} from './adminEvents.ts'
import { ADMIN_KEYS } from './adminQueries.ts'
import { ALL_STATUSES_LABEL, registrationText, STAFF_ONLY_TEXT, STATUS_FILTER_LABELS } from './adminText.ts'
import { AdminPhaseBadge } from './AdminPhaseBadge.tsx'
import { AdminSignedOutNotice } from './AdminSignedOutNotice.tsx'

/**
 * "Eventos da equipe": todos os eventos, rascunhos incluídos. O front não sabe quem é ADMIN: a API responde
 * 403 a quem não é, e a lista só mostra isso. Esconder o link "Equipe" é conforto de navegação, não proteção.
 */
export function AdminEventsPage() {
  return (
    <PageFrame title="Eventos da equipe">
      <RequireSession signInMessage="Entre para ver os eventos da equipe.">
        <AdminEventsContent />
      </RequireSession>
    </PageFrame>
  )
}

const ALL_STATUSES = ''

/** O valor do filtro de volta para o estado; o que não é um estado conhecido (inclusive "todos") é `null`. */
function statusOfFilter(value: string): AdminEventStatus | null {
  return ADMIN_EVENT_STATUSES.find((status) => status === value) ?? null
}

/** O filtro e a lista ficam montados enquanto os resultados trocam, para o foco não sair do filtro. */
function AdminEventsContent() {
  const [status, setStatus] = useState<AdminEventStatus | null>(null)
  const list = usePagedList(ADMIN_KEYS.list(status), (pageToken) => fetchAdminEventsPage(pageToken, status))
  const failure = list.hasFailed ? adminFailureOf(list.error) : null

  if (failure?.kind === 'forbidden') {
    return (
      <p role="alert" className="text-lg text-fg">
        {STAFF_ONLY_TEXT}
      </p>
    )
  }
  if (failure?.kind === 'signedOut') {
    return <AdminSignedOutNotice />
  }
  return (
    <div className="flex flex-col items-start gap-8">
      <AppLink to={PATHS.adminNewEvent} className={PRIMARY_BUTTON}>
        Novo evento
      </AppLink>
      <StatusFilter status={status} onChange={setStatus} />
      <Results list={list} status={status} />
    </div>
  )
}

interface ResultsProps {
  readonly list: ReturnType<typeof usePagedList<AdminEvent>>
  readonly status: AdminEventStatus | null
}

/** Carregando, falha, ou os eventos já lidos com o "Carregar mais". */
function Results({ list, status }: ResultsProps) {
  if (list.items === undefined) {
    return list.hasFailed ? (
      <LoadFailure message="Não foi possível carregar os eventos." onRetry={list.retry} />
    ) : (
      <p role="status" className="text-fg-muted">
        Carregando os eventos…
      </p>
    )
  }
  return (
    <>
      <EventList events={list.items} status={status} hasMore={list.loadMore.hasNextPage} />
      <LoadMore {...list.loadMore} />
    </>
  )
}

interface StatusFilterProps {
  readonly status: AdminEventStatus | null
  readonly onChange: (status: AdminEventStatus | null) => void
}

function StatusFilter({ status, onChange }: StatusFilterProps) {
  const id = useId()
  return (
    <div className="flex w-full max-w-xs flex-col gap-2">
      <label htmlFor={id} className="font-semibold text-fg">
        Mostrar
      </label>
      <select
        id={id}
        value={status ?? ALL_STATUSES}
        onChange={(event) => onChange(statusOfFilter(event.target.value))}
        className={FIELD_CONTROL}
      >
        <option value={ALL_STATUSES}>{ALL_STATUSES_LABEL}</option>
        {ADMIN_EVENT_STATUSES.map((option) => (
          <option key={option} value={option}>
            {STATUS_FILTER_LABELS[option]}
          </option>
        ))}
      </select>
    </div>
  )
}

interface EventListProps {
  readonly events: readonly AdminEvent[]
  readonly status: AdminEventStatus | null
  /** Há mais páginas: uma página vazia no meio do caminho não quer dizer que não há eventos. */
  readonly hasMore: boolean
}

function EventList({ events, status, hasMore }: EventListProps) {
  // A fase vale para o instante em que a lista abriu; mudar o filtro ou recarregar a página a atualiza.
  const [now] = useState(() => new Date())
  if (events.length === 0 && !hasMore) {
    return status === null ? (
      <div className="flex flex-col gap-2">
        <p className="text-lg font-semibold text-fg">Nenhum evento criado ainda.</p>
        <p className="text-fg-muted">O primeiro nasce como rascunho e só a equipe o vê até ele ser publicado.</p>
      </div>
    ) : (
      <p className="text-lg font-semibold text-fg">Nenhum evento neste estado.</p>
    )
  }
  return (
    <ul aria-label="Eventos" className="flex w-full flex-col gap-4">
      {events.map((event) => (
        <li key={event.id} className="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-raised">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <AppLink
              to={adminEventPath(event.id)}
              className="inline-flex min-h-11 min-w-11 items-center font-display text-xl font-medium text-fg underline-offset-4 hover:underline"
            >
              {event.title}
            </AppLink>
            <AdminPhaseBadge phase={adminPhaseAt(event, now)} />
          </div>
          <p className="text-fg-muted">{formatEventTime(event.startsAt, event.endsAt)}</p>
          <p className="text-fg">{registrationText(event)}</p>
        </li>
      ))}
    </ul>
  )
}
