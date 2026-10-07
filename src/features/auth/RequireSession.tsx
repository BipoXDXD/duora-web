import type { ReactNode } from 'react'
import { LoadFailure } from '../../shared/ui/LoadFailure.tsx'
import { PRIMARY_BUTTON } from '../../shared/ui/styles.ts'
import { LOGIN_URL } from './loginUrl.ts'
import { useSession } from './useSession.ts'

interface RequireSessionProps {
  /** O que a pessoa sem sessão lê antes do "Entrar", como "Entre para ver seu perfil." */
  readonly signInMessage: string
  readonly children: ReactNode
}

/**
 * Mostra o conteúdo só para quem entrou. Quem não entrou vê o convite para entrar, e nada do conteúdo é
 * montado, então nenhuma leitura da API é feita à toa. A API continua sendo quem protege os dados.
 */
export function RequireSession({ signInMessage, children }: RequireSessionProps) {
  const session = useSession()
  switch (session.kind) {
    case 'loading':
      return (
        <p role="status" className="text-fg-muted">
          Um instante…
        </p>
      )
    case 'anonymous':
      return (
        <div className="flex flex-col items-start gap-4">
          <p className="text-lg text-fg">{signInMessage}</p>
          <a href={LOGIN_URL} className={PRIMARY_BUTTON}>
            Entrar
          </a>
        </div>
      )
    case 'error':
      return <LoadFailure message="Não foi possível verificar sua sessão." onRetry={session.retry} />
    case 'authenticated':
      return children
  }
}
