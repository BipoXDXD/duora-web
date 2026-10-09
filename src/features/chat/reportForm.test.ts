import { describe, expect, it } from 'vitest'
import {
  DESCRIPTION_MAX_LENGTH,
  descriptionLength,
  messageExcerpt,
  parseReportDraft,
  problemsFromApi,
  quotaWaitText,
} from './reportForm.ts'

describe('descriptionLength', () => {
  it.each([
    ['', 0],
    ['   \n ', 0],
    ['  oi  ', 2],
    ['😀', 1],
    ['👩‍💻', 3],
    ['é', 1],
  ])('counts %j as %i characters, the way the API counts', (text, length) => {
    expect(descriptionLength(text)).toBe(length)
  })
})

describe('parseReportDraft', () => {
  it('asks for a reason when none was chosen', () => {
    expect(parseReportDraft({ reason: null, description: 'algo' })).toEqual({
      kind: 'invalid',
      problems: { reason: 'required', description: null },
    })
  })

  it('accepts a reason without a description, sending it as null', () => {
    expect(parseReportDraft({ reason: 'HARASSMENT', description: '' })).toEqual({
      kind: 'valid',
      body: { reason: 'HARASSMENT', description: null },
    })
  })

  it('sends a description of only spaces as null, as the API reads it', () => {
    expect(parseReportDraft({ reason: 'SCAM_OR_SPAM', description: '  \n  ' })).toEqual({
      kind: 'valid',
      body: { reason: 'SCAM_OR_SPAM', description: null },
    })
  })

  it('sends the description without the spaces at the ends', () => {
    expect(parseReportDraft({ reason: 'HARASSMENT', description: '  Insistiu.\nDuas vezes. ' })).toEqual({
      kind: 'valid',
      body: { reason: 'HARASSMENT', description: 'Insistiu.\nDuas vezes.' },
    })
  })

  it.each(['', '   '])('asks for a description with OTHER when it is %j', (description) => {
    expect(parseReportDraft({ reason: 'OTHER', description })).toEqual({
      kind: 'invalid',
      problems: { reason: null, description: 'requiredForOther' },
    })
  })

  it('accepts OTHER with a description', () => {
    expect(parseReportDraft({ reason: 'OTHER', description: 'Mandou um link estranho.' })).toEqual({
      kind: 'valid',
      body: { reason: 'OTHER', description: 'Mandou um link estranho.' },
    })
  })

  it('accepts a description of exactly the limit', () => {
    const description = 'a'.repeat(DESCRIPTION_MAX_LENGTH)

    expect(parseReportDraft({ reason: 'OTHER', description })).toEqual({
      kind: 'valid',
      body: { reason: 'OTHER', description },
    })
  })

  it('refuses a description one character over the limit, counted in code points', () => {
    expect(parseReportDraft({ reason: 'HARASSMENT', description: '😀'.repeat(DESCRIPTION_MAX_LENGTH + 1) })).toEqual({
      kind: 'invalid',
      problems: { reason: null, description: 'tooLong' },
    })
  })

  it('reports both problems at once', () => {
    expect(parseReportDraft({ reason: null, description: 'a'.repeat(DESCRIPTION_MAX_LENGTH + 1) })).toEqual({
      kind: 'invalid',
      problems: { reason: 'required', description: 'tooLong' },
    })
  })
})

describe('problemsFromApi', () => {
  it.each([
    ['REQUIRED', 'requiredForOther'],
    ['TOO_LONG', 'tooLong'],
    ['FORBIDDEN_CHARACTER', 'forbiddenCharacter'],
    ['INVALID_FORMAT', 'rejected'],
  ] as const)('reads %s on the description as %s', (code, problem) => {
    expect(problemsFromApi([{ field: 'description', code }])).toEqual({ reason: null, description: problem })
  })

  it.each(['REQUIRED', 'UNSUPPORTED_VALUE'] as const)('reads %s on the reason as a reason to choose again', (code) => {
    expect(problemsFromApi([{ field: 'reason', code }])).toEqual({ reason: 'rejected', description: null })
  })

  it('takes the first error of each field', () => {
    expect(
      problemsFromApi([
        { field: 'description', code: 'TOO_LONG' },
        { field: 'description', code: 'FORBIDDEN_CHARACTER' },
        { field: 'reason', code: 'UNSUPPORTED_VALUE' },
      ]),
    ).toEqual({ reason: 'rejected', description: 'tooLong' })
  })

  it.each([
    ['no field errors', []],
    ['an error of the whole body', [{ field: null, code: 'MALFORMED_BODY' }]],
    ['an error of another field', [{ field: 'seq', code: 'SELF_REFERENCE' }]],
  ] as const)('has no field problem with %s', (_case, fieldErrors) => {
    expect(problemsFromApi(fieldErrors)).toBeNull()
  })
})

describe('quotaWaitText', () => {
  it.each([
    [null, 'mais tarde'],
    [0, 'em 1 minuto'],
    [60, 'em 1 minuto'],
    [61, 'em 2 minutos'],
    [3599, 'em 60 minutos'],
    [3600, 'em 1 hora'],
    [3601, 'em 2 horas'],
    [86400, 'em 24 horas'],
  ])('says when to report again after %s seconds', (seconds, text) => {
    expect(quotaWaitText(seconds)).toBe(text)
  })
})

describe('messageExcerpt', () => {
  it('keeps a short message whole, on one line', () => {
    expect(messageExcerpt('Oi!\n  Tudo bem?')).toBe('Oi! Tudo bem?')
  })

  it('keeps a message of exactly the excerpt size whole', () => {
    expect(messageExcerpt('a'.repeat(40))).toBe('a'.repeat(40))
  })

  it('cuts a longer message at 40 characters, without splitting an emoji', () => {
    expect(messageExcerpt(`${'a'.repeat(39)}😀😀`)).toBe(`${'a'.repeat(39)}😀…`)
  })
})
