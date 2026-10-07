import { useMutation, useQuery } from '@tanstack/react-query'
import { isBug } from '../../shared/api/http.ts'
import { navigateTo } from '../../shared/browser/navigateTo.ts'
import { fetchSession, logOut, type Session } from './session.ts'

export type SessionState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly retry: () => void }
  | Session

export type LogoutState = 'idle' | 'loggingOut' | 'failed'

const SESSION_QUERY_KEY = ['session'] as const

/**
 * A sessão de quem visita, compartilhada por todos os componentes que a leem. Sem retry automático: a
 * tela mostra a falha na hora e oferece "Tentar de novo". Se uma nova checagem falhar depois de uma que
 * deu certo (ao voltar para a aba, por exemplo), a última sessão conhecida continua valendo.
 */
export function useSession(): SessionState {
  const query = useQuery({ queryKey: SESSION_QUERY_KEY, queryFn: fetchSession, retry: false, throwOnError: isBug })
  if (query.data !== undefined) {
    return query.data
  }
  if (query.isError) {
    return { kind: 'error', retry: () => void query.refetch() }
  }
  return { kind: 'loading' }
}

/** Sair: a API encerra a sessão e o navegador vai para o logout do Entra, que volta para a landing. */
export function useLogout(): { readonly state: LogoutState; readonly logOut: () => void } {
  const mutation = useMutation({
    mutationFn: logOut,
    onSuccess: (logoutUrl) => navigateTo(logoutUrl),
    throwOnError: isBug,
  })
  return { state: logoutStateOf(mutation.status), logOut: () => mutation.mutate() }
}

/** Depois do sucesso a página está saindo para o Entra, então o botão continua em "Saindo…". */
function logoutStateOf(status: 'idle' | 'pending' | 'error' | 'success'): LogoutState {
  switch (status) {
    case 'idle':
      return 'idle'
    case 'pending':
    case 'success':
      return 'loggingOut'
    case 'error':
      return 'failed'
  }
}
