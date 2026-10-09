import { describe, expect, it } from 'vitest'
import { waitText } from './waitText.ts'

describe('waitText', () => {
  it.each([
    [null, 'em instantes'],
    [0, 'em instantes'],
    [1, 'em 1 segundo'],
    [2, 'em 2 segundos'],
    [30, 'em 30 segundos'],
  ])('says %s seconds as "%s"', (retryAfterSeconds, text) => {
    expect(waitText(retryAfterSeconds)).toBe(text)
  })
})
