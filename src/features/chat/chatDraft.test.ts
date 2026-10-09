import { describe, expect, it } from 'vitest'
import { draftProblemOf, MESSAGE_MAX_LENGTH, problemFromApi } from './chatDraft.ts'

describe('draftProblemOf', () => {
  it.each([
    ['empty', ''],
    ['only spaces and line breaks', '  \n\t '],
  ])('asks for a text when the draft is %s', (_case, text) => {
    expect(draftProblemOf(text)).toBe('empty')
  })

  it('accepts the limit, counted in characters and not in UTF-16 units', () => {
    expect(MESSAGE_MAX_LENGTH).toBe(500)
    expect(draftProblemOf('😀'.repeat(500))).toBeNull()
  })

  it('refuses one character over the limit', () => {
    expect(draftProblemOf('a'.repeat(501))).toBe('tooLong')
  })

  it('does not count the spaces the API removes at the ends', () => {
    expect(draftProblemOf(` ${'a'.repeat(500)}\n`)).toBeNull()
  })

  it('accepts line breaks inside the text', () => {
    expect(draftProblemOf('Oi!\nTudo bem?')).toBeNull()
  })
})

describe('problemFromApi', () => {
  it.each([
    ['TOO_LONG', 'tooLong'],
    ['REQUIRED', 'empty'],
    ['TOO_SHORT', 'empty'],
    ['FORBIDDEN_CHARACTER', 'forbiddenCharacter'],
    ['UNRECOGNIZED', 'rejected'],
  ] as const)('reads %s on the text as %s', (code, problem) => {
    expect(problemFromApi([{ field: 'text', code }])).toBe(problem)
  })

  it('takes the first error of the text', () => {
    expect(
      problemFromApi([
        { field: 'text', code: 'FORBIDDEN_CHARACTER' },
        { field: 'text', code: 'TOO_LONG' },
      ]),
    ).toBe('forbiddenCharacter')
  })

  it.each([
    ['no error listed', []],
    ['an error on the whole body', [{ field: null, code: 'MALFORMED_BODY' }]],
    ['an error on another field', [{ field: 'other', code: 'UNKNOWN_FIELD' }]],
  ] as const)('calls %s a refused text', (_case, errors) => {
    expect(problemFromApi(errors)).toBe('rejected')
  })
})
