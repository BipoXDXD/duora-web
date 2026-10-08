import { describe, expect, it } from 'vitest'
import { characterCount } from './characterCount.ts'

describe('characterCount', () => {
  it.each([
    ['', 0],
    ['a', 1],
    ['Jantar às cegas', 15],
    ['😀', 1],
    ['😀😀', 2],
    ['é', 1],
  ])('counts %j as %i characters', (text, count) => {
    expect(characterCount(text)).toBe(count)
  })
})
