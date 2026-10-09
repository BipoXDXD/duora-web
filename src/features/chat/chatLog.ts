import type { ChatAccess, ChatMessage, Outgoing, SendResult } from './chat.ts'

/**
 * Uma mensagem gravada, com a chave que a lista usa no React. A mensagem que a própria pessoa enviou mantém a
 * `Idempotency-Key` do envio: o item na tela é o mesmo de quando estava pendente, e o leitor de tela não o
 * anuncia de novo. As que chegam pela leitura usam a posição.
 */
export interface Received {
  readonly key: string
  readonly message: ChatMessage
}

/**
 * Um texto ainda sem posição no chat. `failed` vale reenviar com a mesma chave (rede, 429, 503, erro
 * inesperado); `signedOut` pede para entrar de novo; `notSent` é final (chat fechado ou chave já usada).
 */
export type OutgoingStatus =
  | { readonly kind: 'sending' }
  | { readonly kind: 'failed'; readonly retryAfterSeconds: number | null }
  | { readonly kind: 'signedOut' }
  | { readonly kind: 'notSent' }

export interface Pending extends Outgoing {
  readonly status: OutgoingStatus
}

/**
 * O chat como a tela o mostra. `messages` fica em ordem de `seq`, sem repetição; `outgoing` vem depois, na
 * ordem em que a pessoa escreveu. `hasReadMessages` é falso até uma leitura de mensagens responder, mesmo
 * vazia: sem isso, `messages` vazio não distingue "sem mensagens" de "ainda não sei".
 */
export type ChatLog =
  | { readonly kind: 'loading' }
  | { readonly kind: 'notPaired' }
  | {
      readonly kind: 'ready'
      readonly open: boolean
      readonly hasReadMessages: boolean
      readonly messages: readonly Received[]
      readonly outgoing: readonly Pending[]
    }

export type ChatLogAction =
  | { readonly type: 'accessRead'; readonly access: ChatAccess }
  | { readonly type: 'pageReceived'; readonly items: readonly ChatMessage[] }
  | { readonly type: 'sendStarted'; readonly outgoing: Outgoing }
  | { readonly type: 'sendSettled'; readonly key: string; readonly result: SendResult }

export const INITIAL_CHAT_LOG: ChatLog = { kind: 'loading' }

export function chatLogReducer(log: ChatLog, action: ChatLogAction): ChatLog {
  switch (action.type) {
    case 'accessRead':
      return withAccess(log, action.access)
    case 'pageReceived':
      return log.kind === 'ready'
        ? {
            ...log,
            hasReadMessages: true,
            messages: merge(log.messages, action.items.map((message) => ({ key: keyOf(message), message }))),
          }
        : log
    case 'sendStarted':
      return log.kind === 'ready' ? { ...log, outgoing: withSending(log.outgoing, action.outgoing) } : log
    case 'sendSettled':
      return log.kind === 'ready' ? settle(log, action.key, action.result) : log
  }
}

function withAccess(log: ChatLog, access: ChatAccess): ChatLog {
  if (access.kind === 'notPaired') {
    return { kind: 'notPaired' }
  }
  const open = access.kind === 'open'
  return log.kind === 'ready'
    ? { ...log, open }
    : { kind: 'ready', open, hasReadMessages: false, messages: [], outgoing: [] }
}

function keyOf(message: ChatMessage): string {
  return `seq-${message.seq}`
}

/** Junta por posição: a cópia que já estava fica, para a chave do item no React não mudar. */
function merge(messages: readonly Received[], incoming: readonly Received[]): readonly Received[] {
  const bySeq = new Map(messages.map((entry) => [entry.message.seq, entry]))
  for (const entry of incoming) {
    if (!bySeq.has(entry.message.seq)) {
      bySeq.set(entry.message.seq, entry)
    }
  }
  return [...bySeq.values()].toSorted((a, b) => a.message.seq - b.message.seq)
}

/** Um reenvio volta a "enviando" no mesmo lugar; um texto novo entra no fim. */
function withSending(outgoing: readonly Pending[], next: Outgoing): readonly Pending[] {
  const sending: Pending = { ...next, status: { kind: 'sending' } }
  return outgoing.some(({ key }) => key === next.key)
    ? outgoing.map((pending) => (pending.key === next.key ? sending : pending))
    : [...outgoing, sending]
}

type ReadyLog = Extract<ChatLog, { kind: 'ready' }>

function settle(log: ReadyLog, key: string, result: SendResult): ChatLog {
  const withoutIt = log.outgoing.filter((pending) => pending.key !== key)
  switch (result.kind) {
    case 'sent':
      return { ...log, outgoing: withoutIt, messages: merge(log.messages, [{ key, message: result.message }]) }
    case 'invalid':
      return { ...log, outgoing: withoutIt }
    case 'notPaired':
      return { kind: 'notPaired' }
    case 'closed':
      return { ...log, open: false, outgoing: marked(log.outgoing, key, { kind: 'notSent' }) }
    case 'keyReused':
      return { ...log, outgoing: marked(log.outgoing, key, { kind: 'notSent' }) }
    case 'signedOut':
      return { ...log, outgoing: marked(log.outgoing, key, { kind: 'signedOut' }) }
    case 'busy':
      return {
        ...log,
        outgoing: marked(log.outgoing, key, { kind: 'failed', retryAfterSeconds: result.retryAfterSeconds }),
      }
    case 'failed':
      return { ...log, outgoing: marked(log.outgoing, key, { kind: 'failed', retryAfterSeconds: null }) }
  }
}

function marked(outgoing: readonly Pending[], key: string, status: OutgoingStatus): readonly Pending[] {
  return outgoing.map((pending) => (pending.key === key ? { ...pending, status } : pending))
}
