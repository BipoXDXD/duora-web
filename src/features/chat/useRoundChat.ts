import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { ApiError, isApiFailure } from '../../shared/api/http.ts'
import { fetchChatAccess, fetchMessagesAfter, sendMessage, type Outgoing } from './chat.ts'
import { problemFromApi, type DraftProblem } from './chatDraft.ts'
import { chatLogReducer, INITIAL_CHAT_LOG, type ChatLog, type Pending } from './chatLog.ts'
import { POLL_INTERVAL_MS, retryDelayMs } from './pollDelay.ts'

export interface RoundChat {
  readonly log: ChatLog
  /** A última leitura falhou e outra já está marcada. */
  readonly isReconnecting: boolean
  /** Envia um texto novo; devolve o problema quando a API o recusou por ser inválido, para ele voltar ao rascunho. */
  readonly send: (text: string) => Promise<DraftProblem | null>
  /** Reenvia um texto que falhou, com a mesma chave. */
  readonly retry: (pending: Pending) => void
}

type Reading = 'continue' | 'stop'

/**
 * O chat de uma rodada por polling (ADR 0021 da duora-api): lê se aceita mensagens e depois as mensagens depois
 * do cursor, a cada 2 s e só com a aba visível. Ao voltar à aba, relê as duas coisas desde o cursor. Falha de
 * leitura espera cada vez mais, nunca menos que o `Retry-After`. O cursor é a maior posição que a leitura
 * trouxe, e não a de um envio: a mensagem do par gravada logo antes da própria ainda não veio e seria pulada.
 */
export function useRoundChat(eventId: string, roundNumber: number): RoundChat {
  const [log, dispatch] = useReducer(chatLogReducer, INITIAL_CHAT_LOG)
  const [isReconnecting, setReconnecting] = useState(false)
  const rethrow = useRethrowInRender()
  /** Relê se o chat aceita mensagens e as mensagens novas já, fora do intervalo. */
  const readAgainRef = useRef<() => void>(() => undefined)

  useEffect(() => {
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
        dispatch({ type: 'accessRead', access })
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
          dispatch({ type: 'accessRead', access: { kind: 'notPaired' } })
          return 'stop'
        }
        dispatch({ type: 'pageReceived', items: page.items })
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
        setReconnecting(false)
        if (next === 'continue') {
          schedule(POLL_INTERVAL_MS)
        }
      } catch (error) {
        if (!isApiFailure(error)) {
          rethrow(error)
          return
        }
        failures += 1
        setReconnecting(true)
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

    readAgainRef.current = readAgainNow
    document.addEventListener('visibilitychange', onVisibilityChange)
    void read()
    return () => {
      isStopped = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [eventId, roundNumber, rethrow])

  const deliver = useCallback(
    async (outgoing: Outgoing): Promise<DraftProblem | null> => {
      dispatch({ type: 'sendStarted', outgoing })
      const result = await sendMessage(eventId, roundNumber, outgoing)
      dispatch({ type: 'sendSettled', key: outgoing.key, result })
      if (result.kind === 'closed') {
        readAgainRef.current()
      }
      return result.kind === 'invalid' ? problemFromApi(result.fieldErrors) : null
    },
    [eventId, roundNumber],
  )

  const send = useCallback(
    (text: string) =>
      deliver({ key: crypto.randomUUID(), text }).catch((error: unknown) => {
        rethrow(error)
        return null
      }),
    [deliver, rethrow],
  )

  const retry = useCallback(
    ({ key, text }: Pending) => {
      void deliver({ key, text }).catch(rethrow)
    },
    [deliver, rethrow],
  )

  return { log, isReconnecting, send, retry }
}

/**
 * Erro fora de um render (num `await` do polling ou do envio) não chega ao error boundary sozinho. Jogá-lo de
 * dentro de um `setState` faz o React relançá-lo no próximo render, como qualquer bug de tela.
 */
export function useRethrowInRender(): (error: unknown) => void {
  const [, setCrash] = useState<null>(null)
  return useCallback((error: unknown) => {
    setCrash(() => {
      throw error
    })
  }, [])
}
