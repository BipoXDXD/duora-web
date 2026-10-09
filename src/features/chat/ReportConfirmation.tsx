import { useState } from 'react'
import { AppLink } from '../../shared/routing/AppLink.tsx'
import { PATHS } from '../../shared/routing/routes.ts'
import { SECONDARY_BUTTON, TEXT_LINK } from '../../shared/ui/styles.ts'
import { useFocusOnMount } from '../../shared/ui/useFocusOnMount.ts'
import { LOGIN_URL } from '../auth/loginUrl.ts'
import { blockReported } from './blockReported.ts'
import type { BlockOutcome, Confirmation } from './useMessageReports.ts'
import { useRethrowInRender } from './useRoundChat.ts'

interface ReportConfirmationProps {
  readonly confirmation: Confirmation
  readonly onBlockSettled: (block: BlockOutcome) => void
}

/**
 * A confirmação recebe o foco, porque o formulário some. A falha do bloqueio é um alerta à parte, refeito a cada
 * tentativa para ser anunciado de novo.
 */
export function ReportConfirmation({ confirmation, onBlockSettled }: ReportConfirmationProps) {
  const statusRef = useFocusOnMount<HTMLDivElement>()
  const [attempts, setAttempts] = useState(0)
  const [isBlocking, setBlocking] = useState(false)
  const rethrow = useRethrowInRender()
  const { block } = confirmation

  async function blockAgain() {
    setBlocking(true)
    const outcome = await blockReported(confirmation.reportedAccountId)
    setBlocking(false)
    setAttempts((current) => current + 1)
    onBlockSettled(outcome)
  }

  return (
    <div className="flex w-full flex-col items-start gap-3">
      <div
        ref={statusRef}
        tabIndex={-1}
        role="status"
        className="flex w-full flex-col gap-1 rounded-lg bg-primary-subtle p-4 text-on-primary-subtle"
      >
        <p className="font-semibold">Denúncia enviada. A moderação do Duora vai analisar a mensagem.</p>
        {block === 'blocked' && (
          <p>
            Você também bloqueou esta pessoa. Para desfazer, abra{' '}
            <AppLink to={PATHS.blockedAccounts} className={TEXT_LINK}>
              Contas bloqueadas
            </AppLink>
            .
          </p>
        )}
      </div>
      {block === 'failed' && (
        <div key={attempts} role="alert" className="flex flex-col items-start gap-3 font-semibold text-danger">
          <p>A denúncia está feita, mas o bloqueio não deu certo.</p>
          <button
            type="button"
            onClick={() => void blockAgain().catch(rethrow)}
            disabled={isBlocking}
            className={SECONDARY_BUTTON}
          >
            {isBlocking ? 'Bloqueando…' : 'Tentar bloquear de novo'}
          </button>
        </div>
      )}
      {block === 'signedOut' && (
        <div role="alert" className="flex flex-col items-start gap-3 font-semibold text-danger">
          <p>A denúncia está feita, mas sua sessão terminou antes do bloqueio. Entre de novo para bloquear.</p>
          <a href={LOGIN_URL} className={TEXT_LINK}>
            Entrar de novo
          </a>
        </div>
      )}
    </div>
  )
}
