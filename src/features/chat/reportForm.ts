import type { FieldError, FieldErrorCode } from '../../shared/api/http.ts'
import { characterCount } from '../../shared/text/characterCount.ts'
import type { ReportBody, ReportReason } from './messageReport.ts'

/** Em caracteres (code points depois do NFC, sem o espaço das pontas), como a API conta. */
export const DESCRIPTION_MAX_LENGTH = 1000

/** O que a pessoa preencheu, antes de virar corpo. `reason` é `null` até ela escolher um motivo. */
export interface ReportDraft {
  readonly reason: ReportReason | null
  readonly description: string
}

/** `rejected` é a recusa da API sem motivo que a tela saiba explicar. */
export type ReasonProblem = 'required' | 'rejected'
export type DescriptionProblem = 'requiredForOther' | 'tooLong' | 'forbiddenCharacter' | 'rejected'

export interface ReportProblems {
  readonly reason: ReasonProblem | null
  readonly description: DescriptionProblem | null
}

export type ParsedReport =
  | { readonly kind: 'valid'; readonly body: ReportBody }
  | { readonly kind: 'invalid'; readonly problems: ReportProblems }

/** A API tira o espaço das pontas antes de contar; o contador da tela conta igual. */
export function descriptionLength(text: string): number {
  return characterCount(text.trim())
}

/**
 * O rascunho vira corpo ou problemas por campo. O front confere só o que conta igual à API (motivo, descrição
 * exigida com OTHER, tamanho); os caracteres proibidos ficam com ela. Descrição só com espaços vai como `null`.
 */
export function parseReportDraft({ reason, description }: ReportDraft): ParsedReport {
  const trimmed = description.trim()
  const problems: ReportProblems = {
    reason: reason === null ? 'required' : null,
    description: descriptionProblemOf(reason, trimmed),
  }
  if (reason === null || problems.description !== null) {
    return { kind: 'invalid', problems }
  }
  return { kind: 'valid', body: { reason, description: trimmed === '' ? null : trimmed } }
}

function descriptionProblemOf(reason: ReportReason | null, trimmed: string): DescriptionProblem | null {
  if (reason === 'OTHER' && trimmed === '') {
    return 'requiredForOther'
  }
  return characterCount(trimmed) > DESCRIPTION_MAX_LENGTH ? 'tooLong' : null
}

const DESCRIPTION_PROBLEM_BY_CODE: Readonly<Partial<Record<FieldErrorCode, DescriptionProblem>>> = {
  REQUIRED: 'requiredForOther',
  TOO_LONG: 'tooLong',
  FORBIDDEN_CHARACTER: 'forbiddenCharacter',
}

/**
 * Os problemas por campo de um 400, pelo primeiro erro de cada campo. `null` quando nenhum erro é de um campo do
 * formulário (corpo inteiro, ou a mensagem é de quem denuncia): aí vale a recusa genérica.
 */
export function problemsFromApi(fieldErrors: readonly FieldError[]): ReportProblems | null {
  const reasonError = fieldErrors.find(({ field }) => field === 'reason')
  const descriptionError = fieldErrors.find(({ field }) => field === 'description')
  if (reasonError === undefined && descriptionError === undefined) {
    return null
  }
  return {
    reason: reasonError === undefined ? null : 'rejected',
    description:
      descriptionError === undefined ? null : (DESCRIPTION_PROBLEM_BY_CODE[descriptionError.code] ?? 'rejected'),
  }
}

const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 3600

/** Quando a cota diária libera outra denúncia, pelo `Retry-After` (até 24 h), arredondado para cima. */
export function quotaWaitText(retryAfterSeconds: number | null): string {
  if (retryAfterSeconds === null) {
    return 'mais tarde'
  }
  if (retryAfterSeconds < SECONDS_PER_HOUR) {
    const minutes = Math.max(1, Math.ceil(retryAfterSeconds / SECONDS_PER_MINUTE))
    return minutes === 1 ? 'em 1 minuto' : `em ${minutes} minutos`
  }
  const hours = Math.ceil(retryAfterSeconds / SECONDS_PER_HOUR)
  return hours === 1 ? 'em 1 hora' : `em ${hours} horas`
}

/** Quantos caracteres da mensagem entram no nome do botão "Denunciar", para o leitor de tela saber qual é. */
const EXCERPT_LENGTH = 40

/** O começo da mensagem, numa linha só, sem partir um emoji ao meio. */
export function messageExcerpt(text: string): string {
  const characters = [...text.replace(/\s+/g, ' ').trim()]
  return characters.length > EXCERPT_LENGTH ? `${characters.slice(0, EXCERPT_LENGTH).join('')}…` : characters.join('')
}
