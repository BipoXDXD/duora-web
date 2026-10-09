import { z } from 'zod/mini'
import { hasStatus, readJsonBody, sendApiRequest } from '../../shared/api/http.ts'
import { UNAUTHORIZED } from '../../shared/api/httpStatus.ts'

/** Os papéis que o front conhece; o teste confere que são os mesmos que a spec declara. */
export const KNOWN_ROLES = ['ADMIN'] as const

export type Role = (typeof KNOWN_ROLES)[number]

/**
 * Allowlist: papel que o front não conhece é ignorado, não é erro, para a API poder acrescentar papéis sem
 * derrubar a sessão. O resultado segue a ordem de `KNOWN_ROLES` e não repete.
 */
const rolesSchema = z.pipe(
  z.array(z.string()),
  z.transform((names) => KNOWN_ROLES.filter((role) => names.includes(role))),
)

/**
 * Corpo de GET /api/me (CurrentUserResponse da duora-api). Nome em branco conta como sem nome. O
 * schema lê só o que o front usa; `session.test.ts` confere que esses campos batem com o tipo gerado
 * da spec, que é a fonte do contrato. Os papéis só decidem o que mostrar: cada rota confere o papel na API.
 */
const currentUserSchema = z.object({
  displayName: z.pipe(
    z.nullable(z.string()),
    z.transform((name) => {
      const trimmed = name?.trim() ?? ''
      return trimmed === '' ? null : trimmed
    }),
  ),
  roles: rolesSchema,
})

/**
 * Corpo de POST /logout (LogoutResponse da duora-api). Além do que a spec diz, só aceita HTTPS: o front
 * navega para essa URL, então `javascript:` nunca passa. `session.test.ts` confere o campo contra o tipo gerado.
 */
const logoutResponseSchema = z.object({ logoutUrl: z.url({ protocol: /^https$/ }) })

/** O que o schema aceita da API (antes de normalizar o nome); o teste compara com o tipo gerado da spec. */
export type CurrentUserWire = z.input<typeof currentUserSchema>

/** O que o schema aceita do logout; o teste compara com o tipo gerado da spec. */
export type LogoutResponseWire = z.input<typeof logoutResponseSchema>

export type CurrentUser = Readonly<z.output<typeof currentUserSchema>>

export type Session = { readonly kind: 'anonymous' } | { readonly kind: 'authenticated'; readonly user: CurrentUser }

/**
 * Quem está logado. 401 é a resposta normal para quem não entrou; os outros erros (status, rede,
 * corpo fora do contrato) propagam.
 */
export async function fetchSession(): Promise<Session> {
  try {
    const response = await sendApiRequest({ method: 'GET', path: '/api/me' })
    return { kind: 'authenticated', user: await readJsonBody(response, currentUserSchema) }
  } catch (error) {
    if (hasStatus(error, UNAUTHORIZED)) {
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
