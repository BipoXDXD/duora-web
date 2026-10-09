import { describe, expect, it } from 'vitest'
import { MAX_RETRY_DELAY_MS, POLL_INTERVAL_MS, retryDelayMs } from './pollDelay.ts'

const NO_JITTER = () => 0
const FULL_JITTER = () => 1

describe('retryDelayMs', () => {
  it('reads every 2 seconds while the reads work', () => {
    expect(POLL_INTERVAL_MS).toBe(2000)
  })

  it.each([
    [1, 4000],
    [2, 8000],
    [3, 16_000],
    [4, 30_000],
    [10, 30_000],
  ])('doubles the wait after %i failures in a row, up to 30 s', (failures, delay) => {
    expect(retryDelayMs(failures, null, NO_JITTER)).toBe(delay)
  })

  it('spreads the waits by up to a fifth more, so that clients do not come back together', () => {
    expect(retryDelayMs(1, null, FULL_JITTER)).toBe(4800)
    expect(retryDelayMs(10, null, FULL_JITTER)).toBe(MAX_RETRY_DELAY_MS * 1.2)
  })

  it('waits at least the Retry-After the API asked for', () => {
    expect(retryDelayMs(1, 10, NO_JITTER)).toBe(10_000)
  })

  it('keeps its own wait when the Retry-After is shorter', () => {
    expect(retryDelayMs(2, 1, NO_JITTER)).toBe(8000)
  })
})
