import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../app/App.tsx'
import { DINNER, emptyChatRoutes, SESSION } from '../../test/eventFixtures.ts'
import { jsonAnswer, problemAnswer, stubApi, type FakeRoute } from '../../test/fakeApi.ts'
import { stubMatchMedia } from '../../test/fakeMatchMedia.ts'
import { wait } from '../../test/fakeTimers.ts'
import { setVisibility, stubVisibility } from '../../test/fakeVisibility.ts'

const EVENT = `/api/events/${DINNER.id}`
const REGISTRATION = `${EVENT}/registration`
const ROUNDS = `${EVENT}/rounds`
const PARTNER = '0199a1d2-1111-7aaa-8bbb-cccc1a2b3c4d'

const STARTS_AT = new Date(DINNER.startsAt)
const ENDS_AT = new Date(DINNER.endsAt)
const REFRESH_MS = 15_000

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  // A Testing Library só espera com relógio falso se achar o `jest`. Andar 0 ms deixa as respostas chegarem sem
  // mexer nos timers da página, que só o teste adianta, com `wait`.
  vi.stubGlobal('jest', { advanceTimersByTime: () => vi.advanceTimersByTime(0) })
  stubVisibility()
  // O meio do espalhamento: a releitura do evento sai em exatos 15 s.
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
})

afterEach(() => {
  vi.useRealTimers()
  window.history.replaceState(null, '', '/')
})

/** Passa o relógio falso e deixa as respostas (promessas) chegarem. */
const SETTLE_ROUNDS = 5

/** Um turno real do laço de eventos, que o relógio falso não move. */
function nextRealTurn(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel()
    channel.port1.addEventListener('message', () => {
      channel.port1.close()
      resolve()
    })
    channel.port1.start()
    channel.port2.postMessage(null)
  })
}

/**
 * Deixa a tela alcançar o que uma leitura trouxe. O corpo de uma `Response` só se lê em turnos reais do laço de
 * eventos (o `MessageChannel` não é falso), e cada etapa seguinte (a notificação do TanStack Query, a releitura da
 * rodada) é um `setTimeout(0)` que o relógio falso adia em 1 ms quando nasce dentro de um passo. Poucos
 * milissegundos por volta, então só depois de assertar o que depende do instante exato.
 */
async function settle() {
  await act(async () => {
    for (let round = 0; round < SETTLE_ROUNDS; round += 1) {
      await nextRealTurn()
      await vi.advanceTimersByTimeAsync(1)
    }
  })
}

function secondsFrom(instant: Date, seconds: number): Date {
  return new Date(instant.getTime() + seconds * 1000)
}

/** O evento como a API o responde agora; o teste troca `currentRound` e o status entre as leituras. */
function liveEvent(initial: { currentRound: number | null; status?: 'PUBLISHED' | 'CANCELLED' }) {
  const state = { ...initial }
  const route: FakeRoute = () => jsonAnswer({ ...DINNER, ...state })()
  return { route, state }
}

function roundRoutes(rounds: readonly number[]): Record<string, FakeRoute> {
  return Object.fromEntries(
    rounds.flatMap((round) => [
      [`${ROUNDS}/${round}/pairing`, jsonAnswer({ eventId: DINNER.id, roundNumber: round, partnerAccountId: PARTNER })],
      [`${ROUNDS}/${round}/decision`, problemAnswer(404)],
      ...Object.entries(emptyChatRoutes(round)),
    ]),
  )
}

const REGISTERED = jsonAnswer({ eventId: DINNER.id, registeredAt: '2026-10-05T12:00:00Z' })

async function renderEventPage(startsFrom: Date, routes: Readonly<Record<string, FakeRoute>>) {
  vi.setSystemTime(startsFrom)
  stubMatchMedia(false)
  window.history.replaceState(null, '', `/eventos/${DINNER.id}`)
  const fetchMock = stubApi({ ...SESSION, [REGISTRATION]: REGISTERED, ...routes })
  render(<App />)
  await screen.findByRole('heading', { level: 1, name: 'Jantar às cegas' })
  await wait(0)
  return { fetchMock, user: userEvent.setup({ delay: null }) }
}

function eventReads(fetchMock: ReturnType<typeof stubApi>): number {
  return fetchMock.mock.calls.filter(([path]) => path === EVENT).length
}

function readsOf(fetchMock: ReturnType<typeof stubApi>, path: string): number {
  return fetchMock.mock.calls.filter(([calledPath]) => calledPath === path).length
}

/** A região `role="status"` que anuncia a rodada nova, e quantas vezes o texto dela mudou. */
function watchAnnouncements() {
  // O anúncio vem logo depois do título; os outros `status` do painel (carregando, conversa) vêm depois dele.
  const [region] = within(screen.getByRole('region', { name: 'Sua dupla' })).getAllByRole('status')
  if (region === undefined) {
    throw new Error('a região de status da dupla não está na tela')
  }
  let changes = 0
  const observer = new MutationObserver((records) => {
    changes += records.length
  })
  observer.observe(region, { childList: true, characterData: true, subtree: true })
  return {
    text: () => region.textContent,
    changes: () => {
      changes += observer.takeRecords().length
      return changes
    },
    stop: () => observer.disconnect(),
  }
}

describe('event page, with the page open', () => {
  describe('the phase changes by itself', () => {
    it('starts the event at the exact start, with no request to the API', async () => {
      const { fetchMock } = await renderEventPage(secondsFrom(STARTS_AT, -10), { [EVENT]: jsonAnswer(DINNER) })
      expect(screen.getByRole('button', { name: 'Cancelar inscrição' })).toBeInTheDocument()
      expect(screen.queryByText('Em andamento')).not.toBeInTheDocument()

      await wait(9_999)
      expect(screen.queryByText('Em andamento')).not.toBeInTheDocument()
      await wait(1)

      expect(screen.getByText('Em andamento')).toBeInTheDocument()
      expect(await screen.findByText('Nenhuma rodada começou ainda.')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Cancelar inscrição' })).not.toBeInTheDocument()
      expect(eventReads(fetchMock)).toBe(1)
    })

    it('ends the event at the exact end, and from then on reads nothing', async () => {
      const { fetchMock } = await renderEventPage(secondsFrom(ENDS_AT, -10), {
        [EVENT]: jsonAnswer(DINNER),
      })
      expect(await screen.findByText('Nenhuma rodada começou ainda.')).toBeInTheDocument()

      await wait(9_999)
      expect(screen.getByText('Em andamento')).toBeInTheDocument()
      await wait(1)

      expect(screen.getByText('Encerrado')).toBeInTheDocument()
      expect(screen.getByText('Este evento já terminou.')).toBeInTheDocument()
      await wait(10 * 60_000)
      expect(eventReads(fetchMock)).toBe(1)
    })

    it('keeps a cancelled event cancelled at the time of the start', async () => {
      const { fetchMock } = await renderEventPage(secondsFrom(STARTS_AT, -10), {
        [EVENT]: jsonAnswer({ ...DINNER, status: 'CANCELLED' }),
      })

      await wait(10 * 60_000)

      expect(screen.getByText('Este evento foi cancelado.')).toBeInTheDocument()
      expect(eventReads(fetchMock)).toBe(1)
    })
  })

  describe('the event is read again', () => {
    it('only while it is in progress', async () => {
      const { fetchMock } = await renderEventPage(secondsFrom(STARTS_AT, -3600), { [EVENT]: jsonAnswer(DINNER) })

      await wait(3600_000 - 1)
      expect(eventReads(fetchMock)).toBe(1)
      await wait(1)
      expect(eventReads(fetchMock)).toBe(1)

      await wait(REFRESH_MS - 1)
      expect(eventReads(fetchMock)).toBe(1)
      await wait(1)
      expect(eventReads(fetchMock)).toBe(2)
    })

    it('does not read while the tab is hidden, and reads right away when it comes back', async () => {
      const { fetchMock } = await renderEventPage(secondsFrom(STARTS_AT, 60), { [EVENT]: jsonAnswer(DINNER) })

      setVisibility('hidden')
      await wait(10 * 60_000)
      expect(eventReads(fetchMock)).toBe(1)

      setVisibility('visible')
      await wait(0)
      expect(eventReads(fetchMock)).toBe(2)
    })

    it('waits longer after a failure, keeps showing the event, and goes back to normal after a success', async () => {
      const live = liveEvent({ currentRound: 1 })
      let fails = false
      const { fetchMock } = await renderEventPage(secondsFrom(STARTS_AT, 60), {
        [EVENT]: (init) => (fails ? problemAnswer(500)(init) : live.route(init)),
        ...roundRoutes([1]),
      })
      fails = true

      await wait(REFRESH_MS)
      expect(eventReads(fetchMock)).toBe(2)
      expect(screen.getByText('Sua dupla na rodada 1 é a conta 1a2b3c4d.')).toBeInTheDocument()
      expect(screen.queryByText('Não foi possível carregar o evento.')).not.toBeInTheDocument()

      await wait(2 * REFRESH_MS - 1)
      expect(eventReads(fetchMock)).toBe(2)
      fails = false
      await wait(1)
      expect(eventReads(fetchMock)).toBe(3)

      await wait(REFRESH_MS)
      expect(eventReads(fetchMock)).toBe(4)
    })
  })

  describe('a new round starts', () => {
    const DURING = secondsFrom(STARTS_AT, 60)
    const CHAT_1 = `${ROUNDS}/1/chat`
    const CHAT_2 = `${ROUNDS}/2/chat`

    it('moves the person who follows the current round to the new one, without a click', async () => {
      const live = liveEvent({ currentRound: 1 })
      await renderEventPage(DURING, { [EVENT]: live.route, ...roundRoutes([1, 2]) })
      expect(await screen.findByText('Sua dupla na rodada 1 é a conta 1a2b3c4d.')).toBeInTheDocument()

      live.state.currentRound = 2
      await wait(REFRESH_MS)
      await settle()
      expect(await screen.findByText('Sua dupla na rodada 2 é a conta 1a2b3c4d.')).toBeInTheDocument()
      expect(screen.getByText('Rodada atual: 2.')).toBeInTheDocument()
    })

    it('swaps the conversation: the one of the old round goes away and is no longer read', async () => {
      const live = liveEvent({ currentRound: 1 })
      const { fetchMock } = await renderEventPage(DURING, { [EVENT]: live.route, ...roundRoutes([1, 2]) })
      expect(await screen.findByText('Nenhuma mensagem ainda.')).toBeInTheDocument()
      expect(readsOf(fetchMock, CHAT_2)).toBe(0)

      live.state.currentRound = 2
      await wait(REFRESH_MS)
      await settle()
      await screen.findByText('Sua dupla na rodada 2 é a conta 1a2b3c4d.')
      await wait(2_000)

      expect(screen.getAllByRole('heading', { name: 'Conversa com sua dupla' })).toHaveLength(1)
      expect(readsOf(fetchMock, CHAT_2)).toBeGreaterThan(0)
      const readsOfOldChat = readsOf(fetchMock, CHAT_1)
      await wait(10_000)
      expect(readsOf(fetchMock, CHAT_1)).toBe(readsOfOldChat)
    })

    it('announces the new round once, and not again on the readings that bring the same round', async () => {
      const live = liveEvent({ currentRound: 1 })
      await renderEventPage(DURING, { [EVENT]: live.route, ...roundRoutes([1, 2]) })
      await screen.findByText('Sua dupla na rodada 1 é a conta 1a2b3c4d.')
      const announcements = watchAnnouncements()
      expect(announcements.text()).toBe('')

      live.state.currentRound = 2
      await wait(REFRESH_MS)
      await settle()
      await screen.findByText('Sua dupla na rodada 2 é a conta 1a2b3c4d.')
      expect(announcements.text()).toBe('A rodada 2 começou.')
      expect(announcements.changes()).toBe(1)

      await wait(3 * REFRESH_MS)
      await settle()
      expect(announcements.text()).toBe('A rodada 2 começou.')
      expect(announcements.changes()).toBe(1)
      announcements.stop()
    })

    it('does not announce the round that was already current when the page opened', async () => {
      const live = liveEvent({ currentRound: 2 })
      await renderEventPage(DURING, { [EVENT]: live.route, ...roundRoutes([1, 2]) })
      await screen.findByText('Sua dupla na rodada 2 é a conta 1a2b3c4d.')
      const announcements = watchAnnouncements()

      await wait(3 * REFRESH_MS)
      await settle()

      expect(announcements.text()).toBe('')
      expect(announcements.changes()).toBe(0)
      announcements.stop()
    })

    it('announces the first round when it starts after the page opened with none', async () => {
      const live = liveEvent({ currentRound: null })
      await renderEventPage(DURING, { [EVENT]: live.route, ...roundRoutes([1]) })
      expect(await screen.findByText('Nenhuma rodada começou ainda.')).toBeInTheDocument()
      const announcements = watchAnnouncements()

      live.state.currentRound = 1
      await wait(REFRESH_MS)
      await settle()

      expect(await screen.findByText('Sua dupla na rodada 1 é a conta 1a2b3c4d.')).toBeInTheDocument()
      expect(announcements.text()).toBe('A rodada 1 começou.')
      announcements.stop()
    })

    it('announces it to who is looking at an earlier round, and keeps them there', async () => {
      const live = liveEvent({ currentRound: 2 })
      const { user } = await renderEventPage(DURING, { [EVENT]: live.route, ...roundRoutes([1, 2, 3]) })
      await screen.findByText('Sua dupla na rodada 2 é a conta 1a2b3c4d.')
      await user.click(screen.getByRole('button', { name: 'Rodada anterior' }))
      await screen.findByText('Sua dupla na rodada 1 é a conta 1a2b3c4d.')
      const announcements = watchAnnouncements()

      live.state.currentRound = 3
      await wait(REFRESH_MS)
      await settle()

      expect(await screen.findByText('Rodada 1. A rodada atual é a 3.')).toBeInTheDocument()
      expect(screen.getByText('Sua dupla na rodada 1 é a conta 1a2b3c4d.')).toBeInTheDocument()
      expect(announcements.text()).toBe('A rodada 3 começou.')
      announcements.stop()
    })

    it('keeps the button to check by hand, which does not wait for the interval', async () => {
      const live = liveEvent({ currentRound: 1 })
      const { user } = await renderEventPage(DURING, { [EVENT]: live.route, ...roundRoutes([1, 2]) })
      await screen.findByText('Sua dupla na rodada 1 é a conta 1a2b3c4d.')

      live.state.currentRound = 2
      await user.click(screen.getByRole('button', { name: 'Ver se começou outra rodada' }))

      expect(await screen.findByText('Sua dupla na rodada 2 é a conta 1a2b3c4d.')).toBeInTheDocument()
    })

    it('does not blink the button, nor disable it, when the page reads the event on its own', async () => {
      let hold: ((answer: FakeRoute) => void) | undefined
      const live = liveEvent({ currentRound: 1 })
      let isHolding = false
      const route: FakeRoute = (init) =>
        isHolding
          ? new Promise<Response>((resolve) => {
              hold = (answer) => void answer(init).then(resolve)
            })
          : live.route(init)
      await renderEventPage(DURING, { [EVENT]: route, ...roundRoutes([1]) })
      await screen.findByText('Sua dupla na rodada 1 é a conta 1a2b3c4d.')

      isHolding = true
      await wait(REFRESH_MS)
      expect(hold).toBeDefined()

      expect(screen.getByRole('button', { name: 'Ver se começou outra rodada' })).toBeEnabled()
      expect(screen.queryByRole('button', { name: 'Verificando…' })).not.toBeInTheDocument()
      hold?.(live.route)
    })
  })
})
