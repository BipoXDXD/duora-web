import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DINNER } from '../../test/eventFixtures.ts'
import { jsonAnswer, networkFailure, problemAnswer, stubApi, type FakeRoute } from '../../test/fakeApi.ts'
import { EVENT_KEYS, READ_OPTIONS } from './eventQueries.ts'
import { fetchEvent } from './events.ts'
import { useEventRefresh } from './useEventRefresh.ts'

const EVENT = `/api/events/${DINNER.id}`

/** O meio do espalhamento: a releitura sai em 15 s, 30 s depois de uma falha, 60 s depois de duas. */
const MIDDLE = 0.5

let visibility: DocumentVisibilityState = 'visible'

function setVisibility(state: DocumentVisibilityState) {
  visibility = state
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

async function wait(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms))
}

function busy(seconds: number): FakeRoute {
  return () => Promise.resolve(new Response(null, { status: 503, headers: { 'Retry-After': String(seconds) } }))
}

function renderRefresh(route: FakeRoute, isActive = true) {
  const fetchMock = stubApi({ [EVENT]: route })
  const queryClient = new QueryClient()
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const hook = renderHook(
    ({ active }) => {
      // A tela lê o evento com a mesma chave e as mesmas opções; o hook só pede a releitura.
      const query = useQuery({
        queryKey: EVENT_KEYS.event(DINNER.id),
        queryFn: () => fetchEvent(DINNER.id),
        ...READ_OPTIONS,
      })
      useEventRefresh(DINNER.id, active)
      return query
    },
    { wrapper, initialProps: { active: isActive } },
  )
  return { ...hook, fetchMock, reads: () => fetchMock.mock.calls.length }
}

beforeEach(() => {
  vi.useFakeTimers()
  visibility = 'visible'
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
  vi.spyOn(Math, 'random').mockReturnValue(MIDDLE)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useEventRefresh', () => {
  it('reads the event again every 15 seconds while it is active', async () => {
    const { reads } = renderRefresh(jsonAnswer(DINNER))
    await wait(0)
    expect(reads()).toBe(1)

    await wait(14_999)
    expect(reads()).toBe(1)
    await wait(1)
    expect(reads()).toBe(2)
    await wait(15_000)
    expect(reads()).toBe(3)
  })

  it('spreads each wait by up to 20% to each side', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { reads } = renderRefresh(jsonAnswer(DINNER))
    await wait(0)

    await wait(11_999)
    expect(reads()).toBe(1)
    await wait(1)
    expect(reads()).toBe(2)
  })

  it('reads nothing when it is not active, however long the page stays open', async () => {
    const { reads } = renderRefresh(jsonAnswer(DINNER), false)
    await wait(0)

    await wait(10 * 60_000)

    expect(reads()).toBe(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('starts when the event becomes active and stops when it stops being active', async () => {
    const { reads, rerender } = renderRefresh(jsonAnswer(DINNER), false)
    await wait(60_000)
    expect(reads()).toBe(1)

    rerender({ active: true })
    await wait(15_000)
    expect(reads()).toBe(2)

    rerender({ active: false })
    await wait(60_000)
    expect(reads()).toBe(2)
  })

  it('does not read while the tab is hidden', async () => {
    const { reads } = renderRefresh(jsonAnswer(DINNER))
    await wait(0)

    const timersWhileVisible = vi.getTimerCount()
    setVisibility('hidden')
    expect(vi.getTimerCount()).toBe(timersWhileVisible - 1)
    await wait(10 * 60_000)

    expect(reads()).toBe(1)
  })

  it('reads right away when the tab comes back after the wait was due', async () => {
    const { reads } = renderRefresh(jsonAnswer(DINNER))
    await wait(0)
    setVisibility('hidden')
    await wait(60_000)

    setVisibility('visible')
    await wait(0)

    expect(reads()).toBe(2)
  })

  it('waits the time that was left, not a whole interval, when the tab comes back early', async () => {
    const { reads } = renderRefresh(jsonAnswer(DINNER))
    await wait(0)
    await wait(5_000)
    setVisibility('hidden')
    await wait(1_000)

    setVisibility('visible')
    await wait(8_999)
    expect(reads()).toBe(1)
    await wait(1)
    expect(reads()).toBe(2)
  })

  it('does not read twice when the tab flips while a read is in flight', async () => {
    const { reads, fetchMock } = renderRefresh(jsonAnswer(DINNER))
    await wait(0)
    let release: (() => void) | undefined
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          release = () =>
            resolve(new Response(JSON.stringify(DINNER), { headers: { 'Content-Type': 'application/json' } }))
        }),
    )
    await wait(15_000)
    expect(reads()).toBe(2)

    setVisibility('hidden')
    setVisibility('visible')
    await wait(0)
    expect(reads()).toBe(2)
    release?.()
    await wait(14_999)
    expect(reads()).toBe(2)
    await wait(1)
    expect(reads()).toBe(3)
  })

  it.each([
    ['a server error', problemAnswer(500)],
    ['the network down', networkFailure()],
  ])('waits twice as long after %s, and keeps the event it had', async (_case, failure) => {
    const { reads, result } = renderRefresh(inSequenceOf(jsonAnswer(DINNER), failure))
    await wait(0)

    await wait(15_000)
    expect(reads()).toBe(2)
    expect(result.current.data?.title).toBe('Jantar às cegas')

    await wait(29_999)
    expect(reads()).toBe(2)
    await wait(1)
    expect(reads()).toBe(3)
  })

  it('doubles again on each failure in a row, up to 2 minutes, and goes back to 15 s after a success', async () => {
    const failing = problemAnswer(500)
    const { reads } = renderRefresh(
      inSequenceOf(jsonAnswer(DINNER), failing, failing, failing, failing, jsonAnswer(DINNER)),
    )
    await wait(0)

    await wait(15_000) // 2: falha, 30 s
    await wait(30_000) // 3: falha, 60 s
    await wait(60_000) // 4: falha, 120 s
    await wait(120_000) // 5: falha, 120 s
    expect(reads()).toBe(5)
    await wait(119_999)
    expect(reads()).toBe(5)
    await wait(1) // 6: sucesso
    expect(reads()).toBe(6)

    await wait(15_000)
    expect(reads()).toBe(7)
  })

  it('waits at least the Retry-After of a 503 when it is longer than the backoff', async () => {
    const { reads } = renderRefresh(inSequenceOf(jsonAnswer(DINNER), busy(90)))
    await wait(0)
    await wait(15_000)
    expect(reads()).toBe(2)

    await wait(89_999)
    expect(reads()).toBe(2)
    await wait(1)
    expect(reads()).toBe(3)
  })

  it('stops reading when the page goes away', async () => {
    const { reads, unmount } = renderRefresh(jsonAnswer(DINNER))
    await wait(0)

    unmount()
    await wait(10 * 60_000)

    expect(reads()).toBe(1)
  })
})

/** A primeira resposta é a leitura da tela; a última se repete para as releituras seguintes. */
function inSequenceOf(first: FakeRoute, ...rest: readonly FakeRoute[]): FakeRoute {
  const answers = [first, ...rest]
  let call = 0
  return (init) => {
    const answer = answers[Math.min(call, answers.length - 1)] ?? first
    call += 1
    return answer(init)
  }
}
