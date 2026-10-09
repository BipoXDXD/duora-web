import { ApiError, hasStatus, isApiFailure } from '../../shared/api/http.ts'
import { UNAUTHORIZED } from '../../shared/api/httpStatus.ts'
import { fetchChatAccess, fetchMessagesAfter } from './chat.ts'
import type { ChatLogAction } from './chatLog.ts'
import { POLL_INTERVAL_MS, retryDelayMs } from './pollDelay.ts'

type Reading = 'continue' | 'stop'

/** O que o polling devolve para a tela: o que leu e em que estado a conexão está. */
interface ChatPollingCallbacks {
  readonly dispatch: (action: ChatLogAction) => void
  readonly setReconnecting: (isReconnecting: boolean) => void
  readonly setSignedOut: (isSignedOut: boolean) => void
  /** Erro que não é falha da API: um bug, que tem de chegar ao error boundary. */
  readonly rethrow: (error: unknown) => void
}

export interface ChatPolling {
  /** Relê se o chat aceita mensagens e as mensagens novas já, fora do intervalo. */
  readonly readAgainNow: () => void
  readonly stop: () => void
}

/**
 * Começa a ler o chat da rodada: se aceita mensagens e depois as mensagens depois do cursor, a cada 2 s e só com
 * a aba visível (ADR 0021 da duora-api). Ao voltar à aba, relê as duas coisas desde o cursor. Falha de leitura
 * espera cada vez mais, nunca menos que o `Retry-After`; um 401 não espera, porque repetir não o muda. O cursor é
 * a maior posição que a leitura trouxe, e não a de um envio: a mensagem do par gravada logo antes da própria
 * ainda não veio e seria pulada.
 */
export function startChatPolling(eventId: string, roundNumber: number, callbacks: ChatPollingCallbacks): ChatPolling {
  let isStopped = false
  let isReading = false
  let mustReadAccess = true
  let isClosed = false
  let cursor = 0
  let failures = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  async function readOnce(): Promise<Reading> {
    if (mustReadAccess) {
      const access = await fetchChatAccess(eventId, roundNumber)
      if (isStopped) {
        return 'stop'
      }
      callbacks.dispatch({ type: 'accessRead', access })
      if (access.kind === 'notPaired') {
        return 'stop'
      }
      mustReadAccess = false
      isClosed = access.kind === 'closed'
    }
    return readMessages()
  }

  async function readMessages(): Promise<Reading> {
    for (;;) {
      const page = await fetchMessagesAfter(eventId, roundNumber, cursor)
      if (isStopped) {
        return 'stop'
      }
      if (page === null) {
        callbacks.dispatch({ type: 'accessRead', access: { kind: 'notPaired' } })
        return 'stop'
      }
      callbacks.dispatch({ type: 'pageReceived', items: page.items })
      cursor = page.items.at(-1)?.seq ?? cursor
      if (!page.hasMore) {
        // Fechado, ninguém escreve mais: depois de ler tudo, não há o que esperar.
        return isClosed ? 'stop' : 'continue'
      }
    }
  }

  async function read() {
    timer = undefined
    if (isStopped || document.visibilityState === 'hidden') {
      return
    }
    isReading = true
    try {
      const next = await readOnce()
      failures = 0
      callbacks.setReconnecting(false)
      callbacks.setSignedOut(false)
      if (next === 'continue') {
        schedule(POLL_INTERVAL_MS)
      }
    } catch (error) {
      if (!isApiFailure(error)) {
        callbacks.rethrow(error)
        return
      }
      if (hasStatus(error, UNAUTHORIZED)) {
        callbacks.setReconnecting(false)
        callbacks.setSignedOut(true)
        return
      }
      failures += 1
      callbacks.setReconnecting(true)
      schedule(retryDelayMs(failures, error instanceof ApiError ? error.retryAfterSeconds : null, Math.random))
    } finally {
      isReading = false
    }
  }

  function schedule(delayMs: number) {
    if (!isStopped && document.visibilityState !== 'hidden') {
      timer = setTimeout(() => void read(), delayMs)
    }
  }

  function readAgainNow() {
    mustReadAccess = true
    if (!isReading) {
      clearTimeout(timer)
      void read()
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      clearTimeout(timer)
      timer = undefined
    } else {
      readAgainNow()
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  void read()
  return {
    readAgainNow,
    stop: () => {
      isStopped = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    },
  }
}
