import { waitText } from '../../shared/text/waitText.ts'
import type { CancelResult, EventClosure, RegisterResult } from './registrations.ts'

/**
 * O aviso depois de inscrever ou cancelar. `action` é o próximo passo que a tela oferece junto: completar
 * o perfil ou entrar de novo.
 */
export interface RegistrationNotice {
  readonly tone: 'success' | 'error'
  readonly text: string
  readonly action: 'completeProfile' | 'signIn' | null
}

const GONE = 'Este evento não existe mais.'
const SIGNED_OUT = 'Sua sessão terminou. Entre de novo para continuar.'

export function noticeOfRegister(result: RegisterResult): RegistrationNotice {
  switch (result.kind) {
    case 'registered':
      return success('Inscrição feita. Até lá!')
    case 'profileIncomplete':
      return {
        tone: 'error',
        text: 'Para se inscrever, seu perfil precisa estar completo: nome, data de nascimento e região.',
        action: 'completeProfile',
      }
    case 'underage':
      // Sem link para o perfil: a data de nascimento não muda, então "completar" não resolveria.
      return error('Os eventos do Duora são só para maiores de 18 anos, por isso não foi possível fazer esta inscrição.')
    case 'notAllowed':
      return error('Não foi possível fazer a inscrição: sua conta não pode participar deste evento.')
    case 'unavailable':
      return error(UNAVAILABLE_TEXT[result.cause ?? 'unknown'])
    case 'busy':
      return error(busyText(result.retryAfterSeconds))
    case 'notFound':
      return error(GONE)
    case 'signedOut':
      return { tone: 'error', text: SIGNED_OUT, action: 'signIn' }
    case 'failed':
      return error('Não foi possível fazer a inscrição. Tente de novo.')
  }
}

export function noticeOfCancel(result: CancelResult): RegistrationNotice {
  switch (result.kind) {
    case 'cancelled':
      return success('Inscrição cancelada.')
    case 'tooLate':
      return error(TOO_LATE_TEXT[result.cause ?? 'unknown'])
    case 'busy':
      return error(busyText(result.retryAfterSeconds))
    case 'notFound':
      return error(GONE)
    case 'signedOut':
      return { tone: 'error', text: SIGNED_OUT, action: 'signIn' }
    case 'failed':
      return error('Não foi possível cancelar a inscrição. Tente de novo.')
  }
}

/** O 409 da inscrição, por motivo; `unknown` é a recusa genérica, sem `reason` ou com um que o front não conhece. */
const UNAVAILABLE_TEXT: Readonly<Record<EventClosure | 'unknown', string>> = {
  full: 'O evento lotou, então não dá mais para se inscrever.',
  cancelled: 'O evento foi cancelado, então não dá mais para se inscrever.',
  started: 'O evento já começou, e as inscrições estão fechadas.',
  ended: 'O evento já terminou, e as inscrições estão fechadas.',
  unknown: 'Não dá mais para se inscrever: o evento lotou, foi cancelado ou já começou.',
}

const TOO_LATE_TEXT: Readonly<Record<'started' | 'ended' | 'unknown', string>> = {
  started: 'O evento já começou, então a inscrição não pode mais ser cancelada.',
  ended: 'O evento já terminou, então a inscrição não pode mais ser cancelada.',
  unknown: 'A inscrição não pode mais ser cancelada: o evento já começou ou terminou.',
}

/** O 503 (evento ocupado) e o 429 (limite da conta) pedem a mesma coisa: esperar. Por isso o texto não aponta o motivo. */
function busyText(retryAfterSeconds: number | null): string {
  return `Muitos pedidos de inscrição em pouco tempo. Tente de novo ${waitText(retryAfterSeconds)}.`
}

function success(text: string): RegistrationNotice {
  return { tone: 'success', text, action: null }
}

function error(text: string): RegistrationNotice {
  return { tone: 'error', text, action: null }
}
