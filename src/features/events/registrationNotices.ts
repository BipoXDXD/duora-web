import type { CancelResult, RegisterResult } from './registrations.ts'

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
        text: 'Para se inscrever, seu perfil precisa estar completo. Os eventos são só para maiores de 18 anos.',
        action: 'completeProfile',
      }
    case 'unavailable':
      return error('Não dá mais para se inscrever: o evento lotou, foi cancelado ou já começou.')
    case 'busy':
      return error(`Muita gente está se inscrevendo agora. Tente de novo ${waitText(result.retryAfterSeconds)}.`)
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
    case 'alreadyStarted':
      return error('O evento já começou, então a inscrição não pode mais ser cancelada.')
    case 'notFound':
      return error(GONE)
    case 'signedOut':
      return { tone: 'error', text: SIGNED_OUT, action: 'signIn' }
    case 'failed':
      return error('Não foi possível cancelar a inscrição. Tente de novo.')
  }
}

function waitText(retryAfterSeconds: number | null): string {
  if (retryAfterSeconds === null || retryAfterSeconds === 0) {
    return 'em instantes'
  }
  return retryAfterSeconds === 1 ? 'em 1 segundo' : `em ${retryAfterSeconds} segundos`
}

function success(text: string): RegistrationNotice {
  return { tone: 'success', text, action: null }
}

function error(text: string): RegistrationNotice {
  return { tone: 'error', text, action: null }
}
