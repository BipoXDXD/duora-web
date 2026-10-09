import { hasStatus, isApiFailure } from '../../shared/api/http.ts'
import { UNAUTHORIZED } from '../../shared/api/httpStatus.ts'
import { blockAccount } from '../blocks/blockedAccounts.ts'
import type { BlockOutcome } from './useMessageReports.ts'

/** Bloqueia depois da denúncia. Falha esperada vira resultado; bug sobe. */
export async function blockReported(accountId: string): Promise<BlockOutcome> {
  try {
    await blockAccount(accountId)
    return 'blocked'
  } catch (error) {
    if (hasStatus(error, UNAUTHORIZED)) {
      return 'signedOut'
    }
    if (isApiFailure(error)) {
      return 'failed'
    }
    throw error
  }
}
