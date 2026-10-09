import { waitText } from '../../shared/text/waitText.ts'
import type { EventActionResult, StartRoundResult } from './adminEvents.ts'
import { STAFF_ONLY_TEXT } from './adminText.ts'

/** O aviso depois de uma ação da equipe. `action` é o próximo passo que a tela oferece junto. */
export interface AdminNotice {
  readonly tone: 'success' | 'error'
  readonly text: string
  readonly action: 'signIn' | null
}

const SIGNED_OUT = 'Sua sessão terminou. Entre de novo para continuar.'
const GONE = 'Este evento não existe mais.'

export function successNotice(text: string): AdminNotice {
  return { tone: 'success', text, action: null }
}

export function errorNotice(text: string): AdminNotice {
  return { tone: 'error', text, action: null }
}

/** O que valia para todas as chamadas da área da equipe: o 401, o 403 e o 404 do evento. */
const signedOutNotice: AdminNotice = { tone: 'error', text: SIGNED_OUT, action: 'signIn' }

export type EventChange = 'publish' | 'cancel'

/** O que o 409 diz de publicar ou cancelar, por `reason`; sem `reason`, ou com um que o front não conhece, vale a recusa genérica. */
const REFUSED_TEXT: Readonly<Record<EventChange, Readonly<Record<string, string>>>> = {
  publish: {
    EVENT_ALREADY_PUBLISHED: 'Este evento já estava publicado.',
    EVENT_CANCELLED: 'Este evento foi cancelado, então não dá mais para publicá-lo.',
    EVENT_STARTED: 'Este evento já começou, então não dá mais para publicá-lo.',
    EVENT_ENDED: 'Este evento já terminou, então não dá mais para publicá-lo.',
  },
  cancel: {
    EVENT_CANCELLED: 'Este evento já estava cancelado.',
    EVENT_ENDED: 'Este evento já terminou, então não dá mais para cancelá-lo.',
  },
}

const GENERIC_REFUSED_TEXT: Readonly<Record<EventChange, string>> = {
  publish: 'Não foi possível publicar: o evento não é um rascunho, já começou ou mudou ao mesmo tempo. A tela foi atualizada.',
  cancel: 'Não foi possível cancelar: o evento já foi cancelado, já terminou ou mudou ao mesmo tempo. A tela foi atualizada.',
}

const DONE_TEXT: Readonly<Record<EventChange, string>> = {
  publish: 'Evento publicado. Ele já aparece para quem entrou e aceita inscrições.',
  cancel: 'Evento cancelado. Ele continua visível para quem se inscreveu, mas não aceita mais inscrições.',
}

const FAILED_TEXT: Readonly<Record<EventChange, string>> = {
  publish: 'Não foi possível publicar o evento. Tente de novo.',
  cancel: 'Não foi possível cancelar o evento. Tente de novo.',
}

export function noticeOfChange(change: EventChange, result: EventActionResult): AdminNotice {
  switch (result.kind) {
    case 'done':
      return successNotice(DONE_TEXT[change])
    case 'refused':
      return errorNotice(REFUSED_TEXT[change][result.reason ?? ''] ?? GENERIC_REFUSED_TEXT[change])
    case 'forbidden':
      return errorNotice(STAFF_ONLY_TEXT)
    case 'notFound':
      return errorNotice(GONE)
    case 'signedOut':
      return signedOutNotice
    case 'failed':
      return errorNotice(FAILED_TEXT[change])
  }
}

export function noticeOfRound(number: number, result: StartRoundResult): AdminNotice {
  switch (result.kind) {
    case 'started':
      return successNotice(
        result.isNew
          ? `Rodada ${number} iniciada. Cada pessoa já pode ver a própria dupla.`
          : `A rodada ${number} já tinha sido iniciada. Esta é a mesma, sem novo sorteio.`,
      )
    case 'notUnderway':
      return errorNotice('Só dá para iniciar uma rodada com o evento publicado e em andamento. Confira o estado e o horário.')
    case 'outOfSequence':
      return errorNotice(`Não dá para iniciar a rodada ${number}: a anterior ainda não começou. Inicie as rodadas em ordem.`)
    case 'refused':
      return errorNotice('Não foi possível iniciar a rodada: o evento mudou. A tela foi atualizada; confira e tente de novo.')
    case 'busy':
      return errorNotice(busyRoundText(result))
    case 'forbidden':
      return errorNotice(STAFF_ONLY_TEXT)
    case 'notFound':
      return errorNotice(GONE)
    case 'signedOut':
      return signedOutNotice
    case 'failed':
      return errorNotice('Não foi possível iniciar a rodada. Tente de novo; repetir é seguro, a rodada nasce uma vez só.')
  }
}

function busyRoundText(busy: Extract<StartRoundResult, { kind: 'busy' }>): string {
  const wait = waitText(busy.retryAfterSeconds)
  return busy.cause === 'rateLimited'
    ? `Você atingiu o limite de rodadas por hora. Tente de novo ${wait}.`
    : `Outro pedido está iniciando esta rodada, ou o limite da conta não pôde ser conferido. Nada foi gravado. Tente de novo ${wait}.`
}

export function noticeOfCreateFailure(kind: 'forbidden' | 'signedOut' | 'notFound' | 'failed'): AdminNotice {
  switch (kind) {
    case 'forbidden':
      return errorNotice(STAFF_ONLY_TEXT)
    case 'signedOut':
      return signedOutNotice
    case 'notFound':
    case 'failed':
      // A API não tem chave de idempotência aqui (ADR 0016): repetir pode criar um segundo rascunho.
      return errorNotice(
        'Não foi possível confirmar a criação do rascunho. Se tentar de novo e o primeiro já existir, haverá dois rascunhos; cancele o que sobrar.',
      )
  }
}
