import { z } from 'zod/mini'
import type { ProfileResponse } from '../../src/shared/api/contract.ts'
import { aProfile } from './data.ts'
import { json, problem, type ApiAnswer, type ApiRequest, type FakeApi } from './fakeApi.ts'

const PROFILE_PATH = '/api/me/profile'

/** O corpo do PATCH: só estes campos, e nenhum outro (a API rejeita campo desconhecido). */
const editSchema = z.strictObject({
  displayName: z.optional(z.nullable(z.string())),
  birthDate: z.optional(z.nullable(z.string())),
  bio: z.optional(z.nullable(z.string())),
  // Só os estados que as jornadas usam; a lista completa é do app (profile.ts) e não precisa ser repetida aqui.
  region: z.optional(z.nullable(z.enum(['BR-SP', 'BR-RJ']))),
})

/**
 * O perfil com controle de versão otimista, como a API: cada leitura traz um `ETag`, e o PATCH só vale com o
 * `If-Match` da versão atual; senão é 412 e nada é gravado.
 */
export class ProfileServer {
  profile: ProfileResponse
  private version = 1

  constructor(api: FakeApi, profile: ProfileResponse = aProfile()) {
    this.profile = profile
    api
      .on('GET', PROFILE_PATH, () => this.read())
      .on('PATCH', PROFILE_PATH, (request) => this.edit(request))
  }

  /** O ETag da versão atual. */
  get etag(): string {
    return `"v${this.version}"`
  }

  /** Outra aba editou o perfil: a versão sobe, e quem leu antes fica desatualizado. */
  changeElsewhere(changes: Partial<ProfileResponse>): void {
    this.profile = { ...this.profile, ...changes }
    this.version += 1
  }

  private read(): ApiAnswer {
    return json(200, this.profile, { etag: this.etag })
  }

  private edit(request: ApiRequest): ApiAnswer {
    const changes = editSchema.parse(request.body)
    if (request.headers['if-match'] !== this.etag) {
      return problem(412)
    }
    const { displayName, birthDate, bio, region } = changes
    // O PATCH distingue campo ausente (não muda) de `null` (apaga).
    this.profile = {
      ...this.profile,
      ...(displayName !== undefined && { displayName }),
      ...(birthDate !== undefined && { birthDate }),
      ...(bio !== undefined && { bio }),
      ...(region !== undefined && { region }),
    }
    this.version += 1
    return this.read()
  }
}
