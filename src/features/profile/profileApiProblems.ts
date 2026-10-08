import type { FieldError, FieldErrorCode } from '../../shared/api/http.ts'
import { isProfileField, type ProfileField } from './profile.ts'
import type { FieldProblem, FieldProblems } from './profileForm.ts'

/**
 * O que cada `code` da API quer dizer em cada campo. Fora da tabela, o campo só é marcado como recusado
 * (`rejected`). Na data de nascimento a API usa ABOVE_MAXIMUM para menor de idade e BELOW_MINIMUM para
 * idade implausível (descrição de `FieldError.code` na spec).
 */
const PROBLEM_BY_CODE: Readonly<Record<ProfileField, Readonly<Partial<Record<FieldErrorCode, FieldProblem>>>>> = {
  displayName: {
    REQUIRED: 'blank',
    TOO_SHORT: 'blank',
    TOO_LONG: 'tooLong',
    FORBIDDEN_CHARACTER: 'forbiddenCharacter',
  },
  birthDate: {
    INVALID_FORMAT: 'notADate',
    ABOVE_MAXIMUM: 'underage',
    BELOW_MINIMUM: 'implausibleAge',
  },
  bio: {
    TOO_LONG: 'tooLong',
    FORBIDDEN_CHARACTER: 'forbiddenCharacter',
  },
  region: {},
}

export interface ApiProblems {
  /** Um problema por campo do formulário que a API recusou; o primeiro erro de cada campo vale. */
  readonly problems: FieldProblems
  /** Verdadeiro se algum erro não cabe num campo (corpo inteiro, campo de fora) ou se a API não listou nenhum. */
  readonly hasUnplacedProblem: boolean
}

/** Traduz os erros por campo de um 400 em problemas do formulário. */
export function problemsFromApi(fieldErrors: readonly FieldError[]): ApiProblems {
  const problems: Partial<Record<ProfileField, FieldProblem>> = {}
  let hasUnplacedProblem = fieldErrors.length === 0
  for (const { field, code } of fieldErrors) {
    if (field === null || !isProfileField(field)) {
      hasUnplacedProblem = true
    } else {
      problems[field] ??= PROBLEM_BY_CODE[field][code] ?? 'rejected'
    }
  }
  return { problems, hasUnplacedProblem }
}
