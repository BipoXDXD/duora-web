import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DINNER } from '../../test/eventFixtures.ts'
import { setVisibility, startHidden, stubVisibility } from '../../test/fakeVisibility.ts'
import type { SocialEvent } from './events.ts'
import { useEventPhase } from './useEventPhase.ts'

const STARTS_AT = new Date('2026-10-10T22:00:00Z')
const ENDS_AT = new Date('2026-10-11T01:00:00Z')
const EVENT: SocialEvent = { ...DINNER, startsAt: STARTS_AT, endsAt: ENDS_AT }

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

/** Renderiza com o relógio falso em `startsFrom`, e a leitura do evento nesse mesmo instante. */
function renderPhase(event: SocialEvent, startsFrom: Date) {
  vi.setSystemTime(startsFrom)
  return renderHook(({ current }) => useEventPhase(current, startsFrom.getTime()), { initialProps: { current: event } })
}

beforeEach(() => {
  vi.useFakeTimers()
  stubVisibility()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useEventPhase', () => {
  it('starts with the phase of the moment', () => {
    expect(renderPhase(EVENT, new Date(STARTS_AT.getTime() - 10_000)).result.current).toBe('upcoming')
    expect(renderPhase(EVENT, new Date(STARTS_AT.getTime() + 10_000)).result.current).toBe('inProgress')
    expect(renderPhase(EVENT, new Date(ENDS_AT.getTime() + 10_000)).result.current).toBe('ended')
  })

  it('becomes in progress at the exact start, not a millisecond before', () => {
    const { result } = renderPhase(EVENT, new Date(STARTS_AT.getTime() - 10_000))

    advance(9_999)
    expect(result.current).toBe('upcoming')
    advance(1)
    expect(result.current).toBe('inProgress')
  })

  it('becomes ended at the exact end, not a millisecond before', () => {
    const { result } = renderPhase(EVENT, new Date(ENDS_AT.getTime() - 10_000))

    advance(9_999)
    expect(result.current).toBe('inProgress')
    advance(1)
    expect(result.current).toBe('ended')
  })

  it('goes through both limits in a row and then leaves no timer behind', () => {
    const { result } = renderPhase(EVENT, new Date(STARTS_AT.getTime() - 1_000))

    advance(1_000)
    expect(result.current).toBe('inProgress')
    advance(ENDS_AT.getTime() - STARTS_AT.getTime())
    expect(result.current).toBe('ended')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('reaches a start further away than the longest delay a timer accepts', () => {
    const farStart = new Date(STARTS_AT.getTime() + 40 * 24 * 60 * 60 * 1000)
    const event = { ...EVENT, startsAt: farStart, endsAt: new Date(farStart.getTime() + 3_600_000) }
    const { result } = renderPhase(event, STARTS_AT)

    advance(40 * 24 * 60 * 60 * 1000 - 1)
    expect(result.current).toBe('upcoming')
    advance(1)
    expect(result.current).toBe('inProgress')
  })

  it('does not schedule anything for a cancelled event, nor for one that already ended', () => {
    renderPhase({ ...EVENT, status: 'CANCELLED' }, new Date(STARTS_AT.getTime() - 10_000))
    expect(vi.getTimerCount()).toBe(0)

    renderPhase(EVENT, new Date(ENDS_AT.getTime() + 10_000))
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps a cancelled event cancelled when the time of the start passes', () => {
    const { result } = renderPhase({ ...EVENT, status: 'CANCELLED' }, new Date(STARTS_AT.getTime() - 10_000))

    advance(60_000)
    expect(result.current).toBe('cancelled')
  })

  it('stops the timer while the tab is hidden and recalculates from the clock when it comes back', () => {
    const { result } = renderPhase(EVENT, new Date(STARTS_AT.getTime() - 10_000))

    setVisibility('hidden')
    expect(vi.getTimerCount()).toBe(0)
    vi.setSystemTime(new Date(STARTS_AT.getTime() + 5_000))
    advance(60_000)
    expect(result.current).toBe('upcoming')

    setVisibility('visible')
    expect(result.current).toBe('inProgress')
  })

  it('arms the timer again for the time that is left when the tab comes back before the limit', () => {
    const { result } = renderPhase(EVENT, new Date(STARTS_AT.getTime() - 10_000))
    setVisibility('hidden')
    advance(4_000)

    setVisibility('visible')
    advance(5_999)
    expect(result.current).toBe('upcoming')
    advance(1)
    expect(result.current).toBe('inProgress')
  })

  it('does not schedule anything when it opens hidden', () => {
    startHidden()
    renderPhase(EVENT, new Date(STARTS_AT.getTime() - 10_000))

    expect(vi.getTimerCount()).toBe(0)
  })

  it('follows the clock it is given, and a reading of the event newer than the clock counts too', () => {
    const clockMs = STARTS_AT.getTime() - 10_000
    const clock = () => new Date(clockMs)

    const { result, rerender } = renderHook(({ readAt }) => useEventPhase(EVENT, readAt, clock), {
      initialProps: { readAt: clockMs },
    })
    expect(result.current).toBe('upcoming')

    rerender({ readAt: ENDS_AT.getTime() })
    expect(result.current).toBe('ended')
  })

  it('schedules the limits of the new event when the event read again changes its times', () => {
    const { result, rerender } = renderPhase(EVENT, new Date(STARTS_AT.getTime() - 10_000))

    rerender({ current: { ...EVENT, startsAt: new Date(STARTS_AT.getTime() + 60_000) } })
    advance(10_000)
    expect(result.current).toBe('upcoming')
    advance(60_000)
    expect(result.current).toBe('inProgress')
  })

  it('clears the timer and the listener when the page goes away', () => {
    const { unmount } = renderPhase(EVENT, new Date(STARTS_AT.getTime() - 10_000))

    unmount()

    expect(vi.getTimerCount()).toBe(0)
  })
})
