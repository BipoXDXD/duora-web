import { describe, expect, it } from 'vitest'
import { backoffDelayMs } from './backoffDelay.ts'

const RULE = { intervalMs: 1000, capMs: 10_000, spread: { down: 0.5, up: 0.25 } }
const LOWEST = () => 0
const HIGHEST = () => 1

describe('backoffDelayMs', () => {
  it.each([
    [0, 1000],
    [1, 2000],
    [3, 8000],
    [4, 10_000],
    [20, 10_000],
  ])('doubles the interval after %i failures in a row, up to the cap', (failures, delay) => {
    const noSpread = { ...RULE, spread: { down: 0, up: 0 } }

    expect(backoffDelayMs(noSpread, failures, null, LOWEST)).toBe(delay)
  })

  it('spreads the wait from the lowest to the highest share it allows', () => {
    expect(backoffDelayMs(RULE, 1, null, LOWEST)).toBe(1000)
    expect(backoffDelayMs(RULE, 1, null, HIGHEST)).toBe(2500)
  })

  it('can spread only upwards', () => {
    const upOnly = { ...RULE, spread: { down: 0, up: 0.2 } }

    expect(backoffDelayMs(upOnly, 1, null, LOWEST)).toBe(2000)
    expect(backoffDelayMs(upOnly, 1, null, HIGHEST)).toBe(2400)
  })

  it('waits at least the Retry-After the API asked for', () => {
    expect(backoffDelayMs(RULE, 1, 30, LOWEST)).toBe(30_000)
  })

  it('keeps its own wait when the Retry-After is shorter', () => {
    expect(backoffDelayMs(RULE, 3, 1, HIGHEST)).toBe(10_000)
  })
})
