import { describe, expect, it } from 'vitest'
import { EVENT_REFRESH_INTERVAL_MS, MAX_REFRESH_BACKOFF_MS, refreshDelayMs } from './refreshDelay.ts'

const LOWEST = () => 0
const MIDDLE = () => 0.5
const HIGHEST = () => 0.999_999

describe('refreshDelayMs', () => {
  it('reads every 15 seconds while the reads work', () => {
    expect(EVENT_REFRESH_INTERVAL_MS).toBe(15_000)
    expect(refreshDelayMs(0, null, MIDDLE)).toBe(15_000)
  })

  it('spreads the interval by 20% to each side, so that clients that opened together do not read together', () => {
    expect(refreshDelayMs(0, null, LOWEST)).toBe(12_000)
    expect(refreshDelayMs(0, null, HIGHEST)).toBeCloseTo(18_000, 0)
  })

  it.each([
    [1, 30_000],
    [2, 60_000],
    [3, 120_000],
    [4, 120_000],
    [50, 120_000],
  ])('doubles the wait after %i failures in a row, up to 2 minutes', (failures, delay) => {
    expect(refreshDelayMs(failures, null, MIDDLE)).toBe(delay)
  })

  it('spreads the backoff too, around its cap', () => {
    expect(refreshDelayMs(10, null, LOWEST)).toBe(MAX_REFRESH_BACKOFF_MS * 0.8)
    expect(refreshDelayMs(10, null, HIGHEST)).toBeCloseTo(MAX_REFRESH_BACKOFF_MS * 1.2, 0)
  })

  it('waits at least the Retry-After the API asked for', () => {
    expect(refreshDelayMs(1, 90, LOWEST)).toBe(90_000)
  })

  it('keeps its own wait when the Retry-After is shorter', () => {
    expect(refreshDelayMs(2, 1, MIDDLE)).toBe(60_000)
  })
})
