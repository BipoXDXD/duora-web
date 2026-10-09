import type { FieldError, FieldErrorCode } from '../../shared/api/http.ts'
import { isEventField, type EventField, type EventFieldProblem, type EventFieldProblems } from './adminEventForm.ts'

/**
 * O que cada `code` da API quer dizer em cada campo. Fora da tabela, o campo só é marcado como recusado
 * (`rejected`). Nos horários a API usa BELOW_MINIMUM para o início que não é no futuro e para o fim que não
 * é depois do início, e ABOVE_MAXIMUM para o início além de 365 dias e para a duração acima de 12 horas
 * (EventSchedule e Event, na duora-api).
 */
const PROBLEM_BY_CODE: Readonly<Record<EventField, Readonly<Partial<Record<FieldErrorCode, EventFieldProblem>>>>> = {
  title: {
    REQUIRED: 'blank',
    TOO_SHORT: 'blank',
    TOO_LONG: 'tooLong',
    FORBIDDEN_CHARACTER: 'forbiddenCharacter',
  },
  description: {
    REQUIRED: 'blank',
    TOO_SHORT: 'blank',
    TOO_LONG: 'tooLong',
    FORBIDDEN_CHARACTER: 'forbiddenCharacter',
  },
  startsAt: {
    REQUIRED: 'blank',
    INVALID_FORMAT: 'notADate',
    BELOW_MINIMUM: 'inThePast',
    ABOVE_MAXIMUM: 'tooFarAhead',
  },
  endsAt: {
    REQUIRED: 'blank',
    INVALID_FORMAT: 'notADate',
    BELOW_MINIMUM: 'notAfterStart',
    ABOVE_MAXIMUM: 'durationTooLong',
  },
  capacity: {
    REQUIRED: 'blank',
    INVALID_FORMAT: 'notANumber',
    BELOW_MINIMUM: 'belowMinimum',
    ABOVE_MAXIMUM: 'aboveMaximum',
  },
}

export interface ApiEventProblems {
  /** Um problema por campo do formulário que a API recusou; o primeiro erro de cada campo vale. */
  readonly problems: EventFieldProblems
  /** Verdadeiro se algum erro não cabe num campo (corpo inteiro, campo de fora) ou se a API não listou nenhum. */
  readonly hasUnplacedProblem: boolean
}

/** Traduz os erros por campo de um 400 em problemas do formulário. */
export function eventProblemsFromApi(fieldErrors: readonly FieldError[]): ApiEventProblems {
  const problems: Partial<Record<EventField, EventFieldProblem>> = {}
  let hasUnplacedProblem = fieldErrors.length === 0
  for (const { field, code } of fieldErrors) {
    if (field === null || !isEventField(field)) {
      hasUnplacedProblem = true
    } else {
      problems[field] ??= PROBLEM_BY_CODE[field][code] ?? 'rejected'
    }
  }
  return { problems, hasUnplacedProblem }
}
