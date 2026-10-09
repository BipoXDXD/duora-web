import type { JoinWaitlistRequest } from '../../shared/api/contract.ts'
import { ApiError, NetworkError, sendApiRequest } from '../../shared/api/http.ts'
import { BAD_REQUEST, TOO_MANY_REQUESTS } from '../../shared/api/httpStatus.ts'

/** A API responde igual para e-mail novo ou repetido, então não existe um resultado "já inscrito". */
export type JoinWaitlistResult =
  | { readonly kind: 'joined' }
  | { readonly kind: 'invalidEmail' }
  | { readonly kind: 'tooManyAttempts'; readonly retryAfterSeconds: number | null }
  | { readonly kind: 'failed' }

export async function joinWaitlist(email: string): Promise<JoinWaitlistResult> {
  const body: JoinWaitlistRequest = { email }
  try {
    await sendApiRequest({ method: 'POST', path: '/api/waitlist', body })
    return { kind: 'joined' }
  } catch (error) {
    if (error instanceof ApiError) {
      return resultOf(error)
    }
    // Fora a API e a rede, qualquer outra coisa é defeito e propaga.
    if (error instanceof NetworkError) {
      return { kind: 'failed' }
    }
    throw error
  }
}

function resultOf(error: ApiError): JoinWaitlistResult {
  switch (error.status) {
    case BAD_REQUEST:
      return { kind: 'invalidEmail' }
    case TOO_MANY_REQUESTS:
      return { kind: 'tooManyAttempts', retryAfterSeconds: error.retryAfterSeconds }
    default:
      return { kind: 'failed' }
  }
}
