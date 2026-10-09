import { hasStatus } from '../../shared/api/http.ts'
import { UNAUTHORIZED } from '../../shared/api/httpStatus.ts'
import { usePagedList } from '../../shared/api/usePagedList.ts'
import { AppLink } from '../../shared/routing/AppLink.tsx'
import { PATHS } from '../../shared/routing/routes.ts'
import { accountCode } from '../../shared/text/accountCode.ts'
import { formatDay } from '../../shared/text/dateFormat.ts'
import { LoadFailure } from '../../shared/ui/LoadFailure.tsx'
import { LoadMore } from '../../shared/ui/LoadMore.tsx'
import { PageFrame } from '../../shared/ui/PageFrame.tsx'
import { PRIMARY_BUTTON } from '../../shared/ui/styles.ts'
import { LOGIN_URL } from '../auth/loginUrl.ts'
import { RequireSession } from '../auth/RequireSession.tsx'
import { CONNECTION_KEYS } from './connectionQueries.ts'
import { fetchConnectionsPage, type Connection } from './connections.ts'

/** "Conexões": as pessoas com quem houve interesse mútuo depois de uma rodada. */
export function ConnectionsPage() {
  return (
    <PageFrame title="Conexões">
      <RequireSession signInMessage="Entre para ver suas conexões.">
        <ConnectionsList />
      </RequireSession>
    </PageFrame>
  )
}

function ConnectionsList() {
  const list = usePagedList(CONNECTION_KEYS.list, fetchConnectionsPage)

  if (list.items === undefined) {
    return <ListPlaceholder hasFailed={list.hasFailed} error={list.error} onRetry={list.retry} />
  }
  const hasNoConnections = list.items.length === 0 && !list.loadMore.hasNextPage
  return (
    <div className="flex flex-col items-start gap-6">
      {hasNoConnections ? (
        <NoConnections />
      ) : (
        <ul aria-label="Suas conexões" className="flex w-full flex-col gap-4">
          {list.items.map((connection) => (
            <ConnectionItem key={connection.accountId} connection={connection} />
          ))}
        </ul>
      )}
      <LoadMore {...list.loadMore} />
    </div>
  )
}

interface ListPlaceholderProps {
  readonly hasFailed: boolean
  readonly error: Error | null
  readonly onRetry: () => void
}

function ListPlaceholder({ hasFailed, error, onRetry }: ListPlaceholderProps) {
  if (!hasFailed) {
    return (
      <p role="status" className="text-fg-muted">
        Carregando suas conexões…
      </p>
    )
  }
  if (hasStatus(error, UNAUTHORIZED)) {
    return (
      <div role="alert" className="flex flex-col items-start gap-4">
        <p className="text-lg text-fg">Sua sessão terminou. Entre de novo para ver suas conexões.</p>
        <a href={LOGIN_URL} className={PRIMARY_BUTTON}>
          Entrar de novo
        </a>
      </div>
    )
  }
  return <LoadFailure message="Não foi possível carregar suas conexões." onRetry={onRetry} />
}

function NoConnections() {
  return (
    <div className="flex flex-col items-start gap-4">
      <p className="text-lg font-semibold text-fg">Você ainda não tem conexões.</p>
      <p className="text-fg-muted">
        Depois de cada rodada de um evento, você decide em privado se quer continuar em contato com sua dupla. Quando
        as duas pessoas querem, vocês viram uma conexão, e ela aparece aqui.
      </p>
      <AppLink to={PATHS.events} className={PRIMARY_BUTTON}>
        Ver os eventos
      </AppLink>
    </div>
  )
}

/** A API manda só o id da outra conta; o fim dele distingue uma conta da outra, como nas outras telas. */
function ConnectionItem({ connection }: { readonly connection: Connection }) {
  return (
    <li className="flex flex-col gap-1 rounded-lg bg-surface p-4 shadow-raised">
      <p className="font-semibold text-fg">{`Conta ${accountCode(connection.accountId)}`}</p>
      <p className="text-sm text-fg-muted">{`Conectados em ${formatDay(connection.connectedAt)}`}</p>
    </li>
  )
}
