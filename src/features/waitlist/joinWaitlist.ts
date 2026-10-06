import { ApiError, NetworkError, sendApiRequest } from '../../shared/api/http.ts'

/** A API responde igual para e-mail novo ou repetido, então não existe um resultado "já inscrito". */
export type JoinWaitlistResult =
  | { readonly kind: 'joined' }
  | { readonly kind: 'invalidEmail' }
  | { readonly kind: 'tooManyAttempts'; readonly retryAfterSeconds: number | null }
  | { readonly kind: 'failed' }

const BAD_REQUEST = 400
const TOO_MANY_REQUESTS = 429

export async function joinWaitlist(email: string): Promise<JoinWaitlistResult> {
  try {
    await sendApiRequest({ method: 'POST', path: '/api/waitlist', body: { email } })
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
