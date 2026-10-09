import { waitText } from '../../shared/text/waitText.ts'
import type { DecideResult } from './decision.ts'

/** O aviso depois de decidir. `signIn` pede o link "Entrar de novo" junto. */
export interface DecisionNotice {
  readonly tone: 'success' | 'error'
  readonly text: string
  readonly action: 'signIn' | null
}

/**
 * O texto depende só do resultado da própria decisão: nada aqui pode variar com a escolha do par, que o
 * front nem recebe.
 */
export function noticeOfDecide(result: DecideResult): DecisionNotice {
  switch (result.kind) {
    case 'decided':
      return { tone: 'success', text: 'Decisão registrada.', action: null }
    case 'alreadyDecided':
      return error('Você já tinha decidido nesta rodada, e a decisão é final. Esta é a que vale.')
    case 'notPaired':
      return error('Não há o que decidir: você não formou dupla nesta rodada.')
    case 'busy':
      return error(`Não foi possível registrar agora. Tente de novo ${waitText(result.retryAfterSeconds)}.`)
    case 'signedOut':
      return { tone: 'error', text: 'Sua sessão terminou. Entre de novo para continuar.', action: 'signIn' }
    case 'failed':
      return error('Não foi possível registrar sua decisão. Tente de novo.')
  }
}

function error(text: string): DecisionNotice {
  return { tone: 'error', text, action: null }
}
