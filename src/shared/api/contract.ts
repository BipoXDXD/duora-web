import type { components } from './schema.ts'

/**
 * Nomes curtos para os DTOs do contrato da API. Os campos moram só em `schema.d.ts`, gerado de
 * `api/openapi.json` por `npm run api:types`: aqui ninguém recria campo à mão. Só entram os DTOs que o
 * front já usa; acrescente o alias quando uma feature precisar de outro.
 */
export type CurrentUserResponse = components['schemas']['CurrentUserResponse']
export type JoinWaitlistRequest = components['schemas']['JoinWaitlistRequest']
export type LogoutResponse = components['schemas']['LogoutResponse']
