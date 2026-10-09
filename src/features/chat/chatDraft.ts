import type { FieldError, FieldErrorCode } from '../../shared/api/http.ts'
import { characterCount } from '../../shared/text/characterCount.ts'

/** Em caracteres (code points depois do NFC), como a API conta. */
export const MESSAGE_MAX_LENGTH = 500

/**
 * Por que um rascunho não pode ir. O front confere só o que sabe contar igual à API (vazio e tamanho); os
 * caracteres proibidos ficam com ela, que devolve `forbiddenCharacter`. `rejected` é a recusa sem motivo conhecido.
 */
export type DraftProblem = 'empty' | 'tooLong' | 'forbiddenCharacter' | 'rejected'

/** A API tira o espaço das pontas antes de contar; o contador da tela conta igual. */
export function messageLength(text: string): number {
  return characterCount(text.trim())
}

export function draftProblemOf(text: string): DraftProblem | null {
  const length = messageLength(text)
  if (length === 0) {
    return 'empty'
  }
  return length > MESSAGE_MAX_LENGTH ? 'tooLong' : null
}

const PROBLEM_BY_CODE: Readonly<Partial<Record<FieldErrorCode, DraftProblem>>> = {
  REQUIRED: 'empty',
  TOO_SHORT: 'empty',
  TOO_LONG: 'tooLong',
  FORBIDDEN_CHARACTER: 'forbiddenCharacter',
}

const TEXT_FIELD = 'text'

/** O problema do texto num 400; o primeiro erro do campo vale, e o resto é recusa sem motivo conhecido. */
export function problemFromApi(fieldErrors: readonly FieldError[]): DraftProblem {
  const first = fieldErrors.find(({ field }) => field === TEXT_FIELD)
  return first === undefined ? 'rejected' : (PROBLEM_BY_CODE[first.code] ?? 'rejected')
}
