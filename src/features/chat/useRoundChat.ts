import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { sendMessage, type Outgoing } from './chat.ts'
import { problemFromApi, type DraftProblem } from './chatDraft.ts'
import { chatLogReducer, INITIAL_CHAT_LOG, type ChatLog, type Pending } from './chatLog.ts'
import { startChatPolling } from './chatPolling.ts'

export interface RoundChat {
  readonly log: ChatLog
  /** A última leitura falhou e outra já está marcada. */
  readonly isReconnecting: boolean
  /** A leitura voltou 401: a sessão terminou e o polling parou até a pessoa voltar à aba. */
  readonly isSignedOut: boolean
  /** Envia um texto novo; devolve o problema quando a API o recusou por ser inválido, para ele voltar ao rascunho. */
  readonly send: (text: string) => Promise<DraftProblem | null>
  /** Reenvia um texto que falhou, com a mesma chave. */
  readonly retry: (pending: Pending) => void
}

/**
 * O chat de uma rodada: a leitura por polling (veja `startChatPolling`) mais o envio, com a chave de idempotência
 * que o reenvio de uma mensagem que falhou reaproveita.
 */
export function useRoundChat(eventId: string, roundNumber: number): RoundChat {
  const [log, dispatch] = useReducer(chatLogReducer, INITIAL_CHAT_LOG)
  const [isReconnecting, setReconnecting] = useState(false)
  const [isSignedOut, setSignedOut] = useState(false)
  const rethrow = useRethrowInRender()
  /** Relê se o chat aceita mensagens e as mensagens novas já, fora do intervalo. */
  const readAgainRef = useRef<() => void>(() => undefined)

  useEffect(() => {
    const polling = startChatPolling(eventId, roundNumber, { dispatch, setReconnecting, setSignedOut, rethrow })
    readAgainRef.current = polling.readAgainNow
    return polling.stop
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

  return { log, isReconnecting, isSignedOut, send, retry }
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
