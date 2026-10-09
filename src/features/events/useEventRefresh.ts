import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { ApiError } from '../../shared/api/http.ts'
import { systemClock, type Clock } from '../../shared/browser/clock.ts'
import { EVENT_KEYS } from './eventQueries.ts'
import { refreshDelayMs } from './refreshDelay.ts'

/**
 * Enquanto `isActive` (o evento em andamento), relê o evento em segundo plano, que é onde a API diz qual rodada
 * vale (`currentRound`): a cada 15 s com espalhamento de 20%, e só com a aba visível (Page Visibility). Ao voltar
 * à aba, lê na hora se já era a vez de ler, e senão espera o que faltava. Falha espera cada vez mais, nunca
 * menos que o `Retry-After`. Não usa o `refetchInterval` do TanStack Query: ele recalcula o sorteio a cada render
 * e só reavalia o intervalo quando a consulta muda, não quando a fase vira por timer.
 *
 * A leitura vai pela mesma consulta da tela, então a tela atualiza sozinha; falha de leitura não tira o evento
 * já mostrado.
 */
export function useEventRefresh(eventId: string, isActive: boolean, clock: Clock = systemClock): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!isActive) {
      return undefined
    }
    let isStopped = false
    let isRefreshing = false
    let failures = 0
    let dueAt = clock().getTime() + refreshDelayMs(0, null, Math.random)
    let timer: ReturnType<typeof setTimeout> | undefined

    async function refresh() {
      timer = undefined
      if (isStopped || document.visibilityState === 'hidden') {
        return
      }
      isRefreshing = true
      let retryAfterSeconds: number | null = null
      try {
        // Sem cancelar uma leitura em curso (o botão de verificar, por exemplo): as duas dividem o resultado.
        await queryClient.refetchQueries(
          { queryKey: EVENT_KEYS.event(eventId), exact: true },
          { cancelRefetch: false, throwOnError: true },
        )
        failures = 0
      } catch (error) {
        // Bug também cai aqui, mas a consulta tem `throwOnError: isBug` e o React o mostra na tela.
        failures += 1
        retryAfterSeconds = error instanceof ApiError ? error.retryAfterSeconds : null
      } finally {
        isRefreshing = false
      }
      dueAt = clock().getTime() + refreshDelayMs(failures, retryAfterSeconds, Math.random)
      arm()
    }

    function arm() {
      clearTimeout(timer)
      if (isStopped || document.visibilityState === 'hidden') {
        return
      }
      timer = setTimeout(() => void refresh(), Math.max(0, dueAt - clock().getTime()))
    }

    function onVisibilityChange() {
      if (!isRefreshing) {
        arm()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    arm()
    return () => {
      isStopped = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [eventId, isActive, clock, queryClient])
}
