import { waitText } from '../../shared/text/waitText.ts'
import { errorNotice, SIGNED_OUT_NOTICE, successNotice, type Notice } from '../../shared/ui/notice.ts'
import type { DecideResult } from './decision.ts'

/** O aviso depois de decidir. `signIn` pede o link "Entrar de novo" junto. */
export type DecisionNotice = Notice

/**
 * O texto depende só do resultado da própria decisão: nada aqui pode variar com a escolha do par, que o
 * front nem recebe.
 */
export function noticeOfDecide(result: DecideResult): DecisionNotice {
  switch (result.kind) {
    case 'decided':
      return successNotice('Decisão registrada.')
    case 'alreadyDecided':
      return errorNotice('Você já tinha decidido nesta rodada, e a decisão é final. Esta é a que vale.')
    case 'notPaired':
      return errorNotice('Não há o que decidir: você não formou dupla nesta rodada.')
    case 'busy':
      return errorNotice(`Não foi possível registrar agora. Tente de novo ${waitText(result.retryAfterSeconds)}.`)
    case 'signedOut':
      return SIGNED_OUT_NOTICE
    case 'failed':
      return errorNotice('Não foi possível registrar sua decisão. Tente de novo.')
  }
}
