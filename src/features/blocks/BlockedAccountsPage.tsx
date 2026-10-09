import { useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { isApiFailure } from '../../shared/api/http.ts'
import { usePagedList } from '../../shared/api/usePagedList.ts'
import { AppLink } from '../../shared/routing/AppLink.tsx'
import { PATHS } from '../../shared/routing/routes.ts'
import { LoadFailure } from '../../shared/ui/LoadFailure.tsx'
import { LoadMore } from '../../shared/ui/LoadMore.tsx'
import { PageFrame } from '../../shared/ui/PageFrame.tsx'
import { PRIMARY_BUTTON, SECONDARY_BUTTON, TEXT_LINK } from '../../shared/ui/styles.ts'
import { useFocusOnMount } from '../../shared/ui/useFocusOnMount.ts'
import { RequireSession } from '../auth/RequireSession.tsx'
import { fetchBlockedPage, unblockAccount, type BlockedAccount, type BlockedPage } from './blockedAccounts.ts'

const BLOCKED_ACCOUNTS_KEY = ['blocked-accounts'] as const

/** A API não manda o nome de quem foi bloqueado; o fim do id (aleatório no UUIDv7) distingue uma conta da outra. */
const ACCOUNT_CODE_LENGTH = 8

const BLOCKED_AT_FORMAT = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' })

type BlockedPages = InfiniteData<BlockedPage, string | null>

/** "Contas bloqueadas": quem a pessoa bloqueou, paginado, com o desbloqueio confirmado. */
export function BlockedAccountsPage() {
  return (
    <PageFrame title="Contas bloqueadas">
      <RequireSession signInMessage="Entre para ver as contas que você bloqueou.">
        <BlockedAccountsSection />
        <AppLink to={PATHS.profile} className={TEXT_LINK}>
          Voltar ao perfil
        </AppLink>
      </RequireSession>
    </PageFrame>
  )
}

function BlockedAccountsSection() {
  const queryClient = useQueryClient()
  const list = usePagedList(BLOCKED_ACCOUNTS_KEY, fetchBlockedPage)
  const [hasUnblocked, setHasUnblocked] = useState(false)

  const accounts = list.items
  if (accounts === undefined) {
    return list.hasFailed ? (
      <LoadFailure message="Não foi possível carregar as contas bloqueadas." onRetry={list.retry} />
    ) : (
      <p role="status" className="text-fg-muted">
        Carregando as contas bloqueadas…
      </p>
    )
  }

  /** Tira a conta do cache em vez de recarregar: os tokens das páginas seguintes continuam valendo. */
  function removeFromList(accountId: string) {
    queryClient.setQueryData<BlockedPages>(BLOCKED_ACCOUNTS_KEY, (cached) =>
      cached === undefined
        ? cached
        : {
            ...cached,
            pages: cached.pages.map((page) => ({
              ...page,
              items: page.items.filter((account) => account.accountId !== accountId),
            })),
          },
    )
    setHasUnblocked(true)
  }

  const hasNoBlocks = accounts.length === 0 && !list.loadMore.hasNextPage
  return (
    <div className="flex flex-col items-start gap-6">
      {hasUnblocked && <UnblockedNotice />}
      {hasNoBlocks ? (
        <div className="flex flex-col gap-2">
          <p className="text-lg font-semibold text-fg">Você não bloqueou ninguém.</p>
          <p className="text-fg-muted">
            Quando você bloqueia alguém, a pessoa aparece aqui, e você pode desfazer o bloqueio quando quiser.
          </p>
        </div>
      ) : (
        <ul aria-label="Contas bloqueadas" className="flex w-full flex-col gap-4">
          {accounts.map((account) => (
            <BlockedAccountItem key={account.accountId} account={account} onUnblocked={removeFromList} />
          ))}
        </ul>
      )}
      <LoadMore {...list.loadMore} />
    </div>
  )
}

/** Recebe o foco: o botão que a pessoa usou sumiu junto com a conta desbloqueada. */
function UnblockedNotice() {
  const ref = useFocusOnMount<HTMLParagraphElement>()
  return (
    <p
      ref={ref}
      tabIndex={-1}
      role="status"
      className="w-full rounded-lg bg-primary-subtle p-4 font-semibold text-on-primary-subtle"
    >
      Conta desbloqueada.
    </p>
  )
}

type UnblockState = 'idle' | 'confirming' | 'unblocking' | 'failed'

interface BlockedAccountItemProps {
  readonly account: BlockedAccount
  readonly onUnblocked: (accountId: string) => void
}

function BlockedAccountItem({ account, onUnblocked }: BlockedAccountItemProps) {
  const [state, setState] = useState<UnblockState>('idle')
  const [wasCancelled, setWasCancelled] = useState(false)
  const descriptionId = useId()

  async function unblock() {
    setState('unblocking')
    try {
      await unblockAccount(account.accountId)
    } catch (error) {
      if (!isApiFailure(error)) {
        throw error
      }
      setState('failed')
      return
    }
    onUnblocked(account.accountId)
  }

  function cancel() {
    setWasCancelled(true)
    setState('idle')
  }

  const isConfirming = state === 'confirming' || state === 'unblocking'
  return (
    <li className="flex flex-col gap-4 rounded-lg bg-surface p-4 shadow-raised">
      <div id={descriptionId} className="flex flex-col gap-1">
        <p className="font-semibold text-fg">{`Conta ${account.accountId.slice(-ACCOUNT_CODE_LENGTH)}`}</p>
        <p className="text-sm text-fg-muted">{`Bloqueada em ${BLOCKED_AT_FORMAT.format(new Date(account.blockedAt))}`}</p>
      </div>
      {isConfirming ? (
        <ConfirmUnblock
          isUnblocking={state === 'unblocking'}
          onConfirm={() => void unblock()}
          onCancel={cancel}
        />
      ) : (
        <div className="flex flex-col items-start gap-2">
          {state === 'failed' && (
            <p role="alert" className="text-sm font-semibold text-danger">
              Não foi possível desbloquear. Tente de novo.
            </p>
          )}
          <UnblockButton
            hasFocus={wasCancelled}
            describedBy={descriptionId}
            onClick={() => setState('confirming')}
          />
        </div>
      )}
    </li>
  )
}

interface UnblockButtonProps {
  readonly hasFocus: boolean
  readonly describedBy: string
  readonly onClick: () => void
}

/** Ação secundária: o desbloqueio só vira primário no passo de confirmação. */
function UnblockButton({ hasFocus, describedBy, onClick }: UnblockButtonProps) {
  const ref = useFocusOnMount<HTMLButtonElement>()
  return (
    <button
      ref={hasFocus ? ref : undefined}
      type="button"
      aria-describedby={describedBy}
      onClick={onClick}
      className={SECONDARY_BUTTON}
    >
      Desbloquear
    </button>
  )
}

interface ConfirmUnblockProps {
  readonly isUnblocking: boolean
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

function ConfirmUnblock({ isUnblocking, onConfirm, onCancel }: ConfirmUnblockProps) {
  const confirmRef = useFocusOnMount<HTMLButtonElement>()
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-fg">Desbloquear esta conta? Ela volta a poder encontrar você e falar com você no Duora.</p>
      <div className="flex flex-wrap gap-4">
        <button ref={confirmRef} type="button" onClick={onConfirm} disabled={isUnblocking} className={PRIMARY_BUTTON}>
          {isUnblocking ? 'Desbloqueando…' : 'Sim, desbloquear'}
        </button>
        <button type="button" onClick={onCancel} disabled={isUnblocking} className={SECONDARY_BUTTON}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
