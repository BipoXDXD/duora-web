import { z } from 'zod'
import { ApiError, readJsonBody, sendApiRequest } from '../../shared/api/http.ts'

/** Corpo de GET /api/me (CurrentUserResponse da duora-api). Nome em branco conta como sem nome. */
const currentUserSchema = z.object({
  displayName: z
    .string()
    .nullable()
    .transform((name) => {
      const trimmed = name?.trim() ?? ''
      return trimmed === '' ? null : trimmed
    }),
})

/** Corpo de POST /logout. Só HTTPS: o front navega para essa URL, então `javascript:` nunca passa. */
const logoutResponseSchema = z.object({ logoutUrl: z.url({ protocol: /^https$/ }) })

export type CurrentUser = Readonly<z.output<typeof currentUserSchema>>

export type Session = { readonly kind: 'anonymous' } | { readonly kind: 'authenticated'; readonly user: CurrentUser }

const UNAUTHORIZED = 401

/**
 * Quem está logado. 401 é a resposta normal para quem não entrou; os outros erros (status, rede,
 * corpo fora do contrato) propagam.
 */
export async function fetchSession(): Promise<Session> {
  try {
    const response = await sendApiRequest({ method: 'GET', path: '/api/me' })
    return { kind: 'authenticated', user: await readJsonBody(response, currentUserSchema) }
  } catch (error) {
    if (error instanceof ApiError && error.status === UNAUTHORIZED) {
      return { kind: 'anonymous' }
    }
    throw error
  }
}

/**
 * Encerra a sessão na API e devolve a URL de logout do Entra, para onde o front navega em seguida.
 * O `fetch` não seguiria um redirect para outra origem, por isso a API responde 200 com a URL.
 */
export async function logOut(): Promise<string> {
  const response = await sendApiRequest({ method: 'POST', path: '/logout' })
  const { logoutUrl } = await readJsonBody(response, logoutResponseSchema)
  return logoutUrl
}
