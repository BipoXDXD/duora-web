import { z } from 'zod/mini'
import type { EditProfileRequest } from '../../shared/api/contract.ts'
import {
  ApiError,
  type FieldError,
  InvalidResponseError,
  isApiFailure,
  readJsonBody,
  sendApiRequest,
} from '../../shared/api/http.ts'

const PROFILE_PATH = '/api/me/profile'

/** Estados e Distrito Federal pelo código ISO 3166-2, como a API os aceita; o teste confere com a spec. */
export const REGION_CODES = [
  'BR-AC', 'BR-AL', 'BR-AP', 'BR-AM', 'BR-BA', 'BR-CE', 'BR-DF', 'BR-ES', 'BR-GO', 'BR-MA', 'BR-MT', 'BR-MS', 'BR-MG',
  'BR-PA', 'BR-PB', 'BR-PR', 'BR-PE', 'BR-PI', 'BR-RJ', 'BR-RN', 'BR-RS', 'BR-RO', 'BR-RR', 'BR-SC', 'BR-SP', 'BR-SE',
  'BR-TO',
] as const

export type Region = (typeof REGION_CODES)[number]

export function isRegion(value: string): value is Region {
  const codes: readonly string[] = REGION_CODES
  return codes.includes(value)
}

/** O nome de cada região, para a tela; o Record falha na compilação se faltar uma. */
export const REGION_NAMES: Readonly<Record<Region, string>> = {
  'BR-AC': 'Acre',
  'BR-AL': 'Alagoas',
  'BR-AP': 'Amapá',
  'BR-AM': 'Amazonas',
  'BR-BA': 'Bahia',
  'BR-CE': 'Ceará',
  'BR-DF': 'Distrito Federal',
  'BR-ES': 'Espírito Santo',
  'BR-GO': 'Goiás',
  'BR-MA': 'Maranhão',
  'BR-MT': 'Mato Grosso',
  'BR-MS': 'Mato Grosso do Sul',
  'BR-MG': 'Minas Gerais',
  'BR-PA': 'Pará',
  'BR-PB': 'Paraíba',
  'BR-PR': 'Paraná',
  'BR-PE': 'Pernambuco',
  'BR-PI': 'Piauí',
  'BR-RJ': 'Rio de Janeiro',
  'BR-RN': 'Rio Grande do Norte',
  'BR-RS': 'Rio Grande do Sul',
  'BR-RO': 'Rondônia',
  'BR-RR': 'Roraima',
  'BR-SC': 'Santa Catarina',
  'BR-SP': 'São Paulo',
  'BR-SE': 'Sergipe',
  'BR-TO': 'Tocantins',
}

/** Corpo de GET e PATCH /api/me/profile (ProfileResponse da duora-api). */
const profileSchema = z.object({
  displayName: z.nullable(z.string()),
  birthDate: z.nullable(z.iso.date()),
  bio: z.nullable(z.string()),
  region: z.nullable(z.enum(REGION_CODES)),
  complete: z.boolean(),
})

/** O que o schema aceita da API; o teste compara com o tipo gerado da spec. */
export type ProfileWire = z.input<typeof profileSchema>

export type Profile = Readonly<z.output<typeof profileSchema>>

/** O perfil e a versão em que foi lido, que vai no If-Match da próxima edição. */
export interface VersionedProfile {
  readonly profile: Profile
  readonly etag: string
}

export type ProfileField = keyof EditProfileRequest

/** Os campos do perfil na ordem em que aparecem na tela; o teste confere com `EditProfileRequest` da spec. */
export const PROFILE_FIELDS = ['displayName', 'birthDate', 'region', 'bio'] as const satisfies readonly ProfileField[]

export function isProfileField(name: string): name is ProfileField {
  const fields: readonly string[] = PROFILE_FIELDS
  return fields.includes(name)
}

export type EditProfileResult =
  | { readonly kind: 'saved'; readonly saved: VersionedProfile }
  | { readonly kind: 'outdated' }
  | { readonly kind: 'birthDateLocked' }
  /** O 400 da API, com os campos que ela recusou; vazio quando não os disse. */
  | { readonly kind: 'invalid'; readonly fieldErrors: readonly FieldError[] }
  | { readonly kind: 'signedOut' }
  | { readonly kind: 'failed' }

const BAD_REQUEST = 400
const UNAUTHORIZED = 401
const CONFLICT = 409
const PRECONDITION_FAILED = 412

export async function fetchProfile(): Promise<VersionedProfile> {
  return versionedProfileIn(await sendApiRequest({ method: 'GET', path: PROFILE_PATH }))
}

/**
 * Edita só os campos de `changes` (ausente não muda, `null` apaga) sobre a versão `etag`. Falhas esperadas
 * viram resultado; um bug propaga.
 */
export async function editProfile(etag: string, changes: EditProfileRequest): Promise<EditProfileResult> {
  try {
    const response = await sendApiRequest({ method: 'PATCH', path: PROFILE_PATH, ifMatch: etag, body: changes })
    return { kind: 'saved', saved: await versionedProfileIn(response) }
  } catch (error) {
    if (error instanceof ApiError) {
      return resultOf(error)
    }
    if (isApiFailure(error)) {
      return { kind: 'failed' }
    }
    throw error
  }
}

async function versionedProfileIn(response: Response): Promise<VersionedProfile> {
  const etag = response.headers.get('ETag')
  if (etag === null) {
    throw new InvalidResponseError()
  }
  return { profile: await readJsonBody(response, profileSchema), etag }
}

function resultOf(error: ApiError): EditProfileResult {
  switch (error.status) {
    case BAD_REQUEST:
      return { kind: 'invalid', fieldErrors: error.fieldErrors }
    case UNAUTHORIZED:
      return { kind: 'signedOut' }
    case CONFLICT:
      return { kind: 'birthDateLocked' }
    case PRECONDITION_FAILED:
      return { kind: 'outdated' }
    default:
      return { kind: 'failed' }
  }
}
