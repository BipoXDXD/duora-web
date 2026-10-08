import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../app/App.tsx'
import { BEFORE_EVENTS, DINNER, SESSION } from '../../test/eventFixtures.ts'
import {
  ANONYMOUS_SESSION,
  byMethod,
  inSequence,
  jsonAnswer,
  neverAnswer,
  problemAnswer,
  refusalAnswer,
  statusAnswer,
  stubApi,
  type FakeRoute,
} from '../../test/fakeApi.ts'
import { stubMatchMedia } from '../../test/fakeMatchMedia.ts'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../shared/ui/styles.ts'
import { elementsWithoutTouchTarget } from '../../test/touchTarget.ts'

const EVENT = `/api/events/${DINNER.id}`
const REGISTRATION = `${EVENT}/registration`
const REGISTERED = jsonAnswer({ eventId: DINNER.id, registeredAt: '2026-10-05T12:00:00Z' })
const NOT_REGISTERED = problemAnswer(404)

function busyAnswer(status: number): FakeRoute {
  return () => Promise.resolve(new Response(null, { status, headers: { 'Retry-After': '3' } }))
}

const BUSY = busyAnswer(503)

function pairingAnswer(roundNumber: number, partnerAccountId: string | null): FakeRoute {
  return jsonAnswer({ eventId: DINNER.id, roundNumber, partnerAccountId })
}

/** Durante o jantar (19:00 às 22:00 em Brasília). */
const DURING_EVENT = new Date('2026-10-10T23:00:00Z')
const AFTER_EVENT = new Date('2026-10-11T02:00:00Z')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(BEFORE_EVENTS)
})

afterEach(() => {
  vi.useRealTimers()
  window.history.replaceState(null, '', '/')
  document.cookie = 'XSRF-TOKEN=; path=/; max-age=0'
})

function renderEventPage(routes: Readonly<Record<string, FakeRoute>>, session = SESSION) {
  stubMatchMedia(false)
  window.history.replaceState(null, '', `/eventos/${DINNER.id}`)
  const fetchMock = stubApi({ ...session, ...routes })
  render(<App />)
  return { fetchMock, user: userEvent.setup() }
}

function callsTo(fetchMock: ReturnType<typeof stubApi>, path: string, method: string) {
  return fetchMock.mock.calls.filter(([calledPath, init]) => calledPath === path && (init?.method ?? 'GET') === method)
}

describe('event page', () => {
  it('asks a visitor who is not logged in to sign in, without reading the event', async () => {
    const { fetchMock } = renderEventPage({ [EVENT]: neverAnswer() }, ANONYMOUS_SESSION)

    expect(await screen.findByText('Entre para ver este evento.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith(EVENT, expect.anything())
  })

  it('shows that the event is loading', async () => {
    renderEventPage({ [EVENT]: neverAnswer() })

    expect(await screen.findByText('Carregando o evento…')).toBeInTheDocument()
  })

  it('offers to try again when the event could not be read', async () => {
    const { user } = renderEventPage({
      [EVENT]: inSequence(problemAnswer(500), jsonAnswer(DINNER)),
      [REGISTRATION]: NOT_REGISTERED,
    })

    expect(await screen.findByText('Não foi possível carregar o evento.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Jantar às cegas' })).toBeInTheDocument()
  })

  it('says the event does not exist on 404, with the way back to the events', async () => {
    renderEventPage({ [EVENT]: problemAnswer(404) })

    expect(await screen.findByRole('heading', { level: 1, name: 'Evento não encontrado' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver todos os eventos' })).toHaveAttribute('href', '/eventos')
  })

  it('shows the event with the time in the time zone of the user, and focuses its title', async () => {
    renderEventPage({ [EVENT]: jsonAnswer(DINNER), [REGISTRATION]: NOT_REGISTERED })

    const title = await screen.findByRole('heading', { level: 1, name: 'Jantar às cegas' })
    expect(title).toHaveFocus()
    expect(screen.getByText(/sábado, 10 de outubro.*19:00.*22:00/)).toBeInTheDocument()
    expect(screen.getByText(/Uma noite de jogos de mesa\./)).toBeInTheDocument()
  })

  describe('registration before the event', () => {
    it('offers to register when the person is not registered', async () => {
      renderEventPage({ [EVENT]: jsonAnswer(DINNER), [REGISTRATION]: NOT_REGISTERED })

      expect(await screen.findByRole('button', { name: 'Quero me inscrever' })).toBeEnabled()
      expect(screen.getByText('As inscrições estão abertas.')).toBeInTheDocument()
    })

    it('offers to try again when the registration could not be read', async () => {
      const { user } = renderEventPage({
        [EVENT]: jsonAnswer(DINNER),
        [REGISTRATION]: inSequence(problemAnswer(500), REGISTERED),
      })

      expect(await screen.findByText('Não foi possível verificar sua inscrição.')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))

      expect(await screen.findByText('Você está na lista desde 5 de outubro de 2026.')).toBeInTheDocument()
    })

    it('registers with the CSRF token and says so, with the focus on the confirmation', async () => {
      document.cookie = 'XSRF-TOKEN=csrf-123; path=/'
      const { fetchMock, user } = renderEventPage({
        [EVENT]: jsonAnswer(DINNER),
        [REGISTRATION]: byMethod({
          GET: NOT_REGISTERED,
          PUT: jsonAnswer({ eventId: DINNER.id, registeredAt: '2026-10-08T15:00:00Z' }, 201),
        }),
      })

      await user.click(await screen.findByRole('button', { name: 'Quero me inscrever' }))

      const notice = await screen.findByRole('status')
      expect(notice).toHaveTextContent('Inscrição feita. Até lá!')
      expect(notice).toHaveFocus()
      expect(screen.getByText('Você está na lista desde 8 de outubro de 2026.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancelar inscrição' })).toBeInTheDocument()
      const [put] = callsTo(fetchMock, REGISTRATION, 'PUT')
      expect(new Headers(put?.[1]?.headers).get('X-XSRF-TOKEN')).toBe('csrf-123')
    })

    it('says it is registering and blocks a second click meanwhile', async () => {
      const { user } = renderEventPage({
        [EVENT]: jsonAnswer(DINNER),
        [REGISTRATION]: byMethod({ GET: NOT_REGISTERED, PUT: neverAnswer() }),
      })

      await user.click(await screen.findByRole('button', { name: 'Quero me inscrever' }))

      await waitFor(() => expect(screen.getByRole('button', { name: 'Inscrevendo…' })).toBeDisabled())
    })

    it('explains an incomplete profile on a 403 PROFILE_INCOMPLETE and links to the profile', async () => {
      const { user } = renderEventPage({
        [EVENT]: jsonAnswer(DINNER),
        [REGISTRATION]: byMethod({ GET: NOT_REGISTERED, PUT: refusalAnswer(403, 'PROFILE_INCOMPLETE') }),
        '/api/me/profile': neverAnswer(),
      })

      await user.click(await screen.findByRole('button', { name: 'Quero me inscrever' }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Para se inscrever, seu perfil precisa estar completo')
      expect(alert).not.toHaveTextContent('18 anos')
      await user.click(screen.getByRole('link', { name: 'Completar meu perfil' }))
      expect(window.location.pathname).toBe('/perfil')
    })

    it('tells an underage account that events are for adults, with no link to complete the profile', async () => {
      const { user } = renderEventPage({
        [EVENT]: jsonAnswer(DINNER),
        [REGISTRATION]: byMethod({ GET: NOT_REGISTERED, PUT: refusalAnswer(403, 'UNDERAGE') }),
      })

      await user.click(await screen.findByRole('button', { name: 'Quero me inscrever' }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Os eventos do Duora são só para maiores de 18 anos')
      expect(screen.queryByRole('link', { name: 'Completar meu perfil' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Quero me inscrever' }).className).toBe(PRIMARY_BUTTON)
    })

    it.each([
      ['has no reason', problemAnswer(403)],
      ['has a reason the front does not know', refusalAnswer(403, 'SOMETHING_NEW')],
    ])('gives the generic refusal, with no link, when a 403 %s', async (_case, answer) => {
      const { user } = renderEventPage({
        [EVENT]: jsonAnswer(DINNER),
        [REGISTRATION]: byMethod({ GET: NOT_REGISTERED, PUT: answer }),
      })

      await user.click(await screen.findByRole('button', { name: 'Quero me inscrever' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Não foi possível fazer a inscrição: sua conta não pode participar deste evento.',
      )
      expect(screen.queryByRole('link', { name: 'Completar meu perfil' })).not.toBeInTheDocument()
    })

    it('keeps a single primary button: the next step in the notice outranks "Quero me inscrever"', async () => {
      const { user } = renderEventPage({
        [EVENT]: jsonAnswer(DINNER),
        [REGISTRATION]: byMethod({ GET: NOT_REGISTERED, PUT: refusalAnswer(403, 'PROFILE_INCOMPLETE') }),
        '/api/me/profile': neverAnswer(),
      })
      const register = await screen.findByRole('button', { name: 'Quero me inscrever' })
      expect(register.className).toBe(PRIMARY_BUTTON)

      await user.click(register)

      const next = await screen.findByRole('link', { name: 'Completar meu perfil' })
      expect(next.className).toBe(PRIMARY_BUTTON)
      expect(screen.getByRole('button', { name: 'Quero me inscrever' }).className).toBe(SECONDARY_BUTTON)
    })

    it('demotes "Quero me inscrever" while the notice asks to sign in again', async () => {
      const { user } = renderEventPage({
        [EVENT]: jsonAnswer(DINNER),
        [REGISTRATION]: byMethod({ GET: NOT_REGISTERED, PUT: statusAnswer(401) }),
      })

      await user.click(await screen.findByRole('button', { name: 'Quero me inscrever' }))

      expect((await screen.findByRole('link', { name: 'Entrar de novo' })).className).toBe(PRIMARY_BUTTON)
      expect(screen.getByRole('button', { name: 'Quero me inscrever' }).className).toBe(SECONDARY_BUTTON)
    })

    it('keeps "Quero me inscrever" primary when the notice has no next step', async () => {
      const { user } = renderEventPage({
        [EVENT]: jsonAnswer(DINNER),
        [REGISTRATION]: byMethod({ GET: NOT_REGISTERED, PUT: BUSY }),
      })

      await user.click(await screen.findByRole('button', { name: 'Quero me inscrever' }))

      await screen.findByRole('alert')
      expect(screen.getByRole('button', { name: 'Quero me inscrever' }).className).toBe(PRIMARY_BUTTON)
    })

    it('explains a cancelled event on 409 EVENT_CANCELLED and reads the event again', async () => {
      const { user } = renderEventPage({
        [EVENT]: inSequence(jsonAnswer(DINNER), jsonAnswer({ ...DINNER, status: 'CANCELLED' })),
        [REGISTRATION]: byMethod({ GET: NOT_REGISTERED, PUT: refusalAnswer(409, 'EVENT_CANCELLED') }),
      })

      await user.click(await screen.findByRole('button', { name: 'Quero me inscrever' }))

      expect(await screen.findByText('Este evento foi cancelado.')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Quero me inscrever' })).not.toBeInTheDocument()
    })

    it.each([
      ['EVENT_FULL', 'O evento lotou, então não dá mais para se inscrever.'],
      ['EVENT_STARTED', 'O evento já começou, e as inscrições estão fechadas.'],
      ['EVENT_ENDED', 'O evento já terminou, e as inscrições estão fechadas.'],
    ])('names the reason %s of a 409 and keeps the offer to register', async (reason, text) => {
      const { user } = renderEventPage({
        [EVENT]: jsonAnswer(DINNER),
        [REGISTRATION]: byMethod({ GET: NOT_REGISTERED, PUT: refusalAnswer(409, reason) }),
      })

      await user.click(await screen.findByRole('button', { name: 'Quero me inscrever' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(text)
      expect(screen.getByRole('button', { name: 'Quero me inscrever' })).toBeEnabled()
    })

    it.each([
      ['has no reason', problemAnswer(409)],
      ['has a reason the front does not know', refusalAnswer(409, 'SOMETHING_NEW')],
      ['has a reason that does not fit a registration', refusalAnswer(409, 'DECISION_ALREADY_MADE')],
    ])('gives the generic refusal when a 409 %s', async (_case, answer) => {
      const { user } = renderEventPage({
        [EVENT]: jsonAnswer(DINNER),
        [REGISTRATION]: byMethod({ GET: NOT_REGISTERED, PUT: answer }),
      })

      await user.click(await screen.findByRole('button', { name: 'Quero me inscrever' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Não dá mais para se inscrever: o evento lotou, foi cancelado ou já começou.',
      )
    })

    it.each([503, 429])('asks to wait the seconds of Retry-After on a %s', async (status) => {
      const { user } = renderEventPage({
        [EVENT]: jsonAnswer(DINNER),
        [REGISTRATION]: byMethod({ GET: NOT_REGISTERED, PUT: busyAnswer(status) }),
      })

      await user.click(await screen.findByRole('button', { name: 'Quero me inscrever' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Tente de novo em 3 segundos.')
      expect(screen.getByRole('button', { name: 'Quero me inscrever' })).toBeEnabled()
    })

    it('offers to sign in again when the session ended', async () => {
      const { user } = renderEventPage({
        [EVENT]: jsonAnswer(DINNER),
        [REGISTRATION]: byMethod({ GET: NOT_REGISTERED, PUT: statusAnswer(401) }),
      })

      await user.click(await screen.findByRole('button', { name: 'Quero me inscrever' }))

      expect(await screen.findByRole('link', { name: 'Entrar de novo' })).toHaveAttribute(
        'href',
        '/oauth2/authorization/entra',
      )
    })

    it('says the registration failed on another error, and announces a second failure again', async () => {
      const { user } = renderEventPage({
        [EVENT]: jsonAnswer(DINNER),
        [REGISTRATION]: byMethod({ GET: NOT_REGISTERED, PUT: problemAnswer(500) }),
      })
      await user.click(await screen.findByRole('button', { name: 'Quero me inscrever' }))
      const first = await screen.findByRole('alert')
      expect(first).toHaveTextContent('Não foi possível fazer a inscrição. Tente de novo.')

      await user.click(screen.getByRole('button', { name: 'Quero me inscrever' }))

      await waitFor(() => expect(screen.getByRole('alert')).not.toBe(first))
    })

    it('asks for confirmation before cancelling, and "Manter inscrição" changes nothing', async () => {
      const { fetchMock, user } = renderEventPage({ [EVENT]: jsonAnswer(DINNER), [REGISTRATION]: REGISTERED })

      await user.click(await screen.findByRole('button', { name: 'Cancelar inscrição' }))

      expect(screen.getByText(/Cancelar sua inscrição\?/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Sim, cancelar' })).toHaveFocus()

      await user.click(screen.getByRole('button', { name: 'Manter inscrição' }))

      expect(screen.getByRole('button', { name: 'Cancelar inscrição' })).toHaveFocus()
      expect(callsTo(fetchMock, REGISTRATION, 'DELETE')).toHaveLength(0)
    })

    it('cancels on confirmation and offers to register again', async () => {
      document.cookie = 'XSRF-TOKEN=csrf-123; path=/'
      const { fetchMock, user } = renderEventPage({
        [EVENT]: jsonAnswer(DINNER),
        [REGISTRATION]: byMethod({ GET: REGISTERED, DELETE: statusAnswer(204) }),
      })

      await user.click(await screen.findByRole('button', { name: 'Cancelar inscrição' }))
      await user.click(screen.getByRole('button', { name: 'Sim, cancelar' }))

      const notice = await screen.findByRole('status')
      expect(notice).toHaveTextContent('Inscrição cancelada.')
      expect(notice).toHaveFocus()
      expect(screen.getByRole('button', { name: 'Quero me inscrever' })).toBeInTheDocument()
      const [deletion] = callsTo(fetchMock, REGISTRATION, 'DELETE')
      expect(new Headers(deletion?.[1]?.headers).get('X-XSRF-TOKEN')).toBe('csrf-123')
    })

    it('says it is cancelling and blocks a second click meanwhile', async () => {
      const { user } = renderEventPage({
        [EVENT]: jsonAnswer(DINNER),
        [REGISTRATION]: byMethod({ GET: REGISTERED, DELETE: neverAnswer() }),
      })

      await user.click(await screen.findByRole('button', { name: 'Cancelar inscrição' }))
      await user.click(screen.getByRole('button', { name: 'Sim, cancelar' }))

      await waitFor(() => expect(screen.getByRole('button', { name: 'Cancelando…' })).toBeDisabled())
    })

    it.each([
      ['EVENT_STARTED', 'O evento já começou, então a inscrição não pode mais ser cancelada.'],
      ['EVENT_ENDED', 'O evento já terminou, então a inscrição não pode mais ser cancelada.'],
    ])('keeps the registration and explains a 409 %s', async (reason, text) => {
      const { user } = renderEventPage({
        [EVENT]: jsonAnswer(DINNER),
        [REGISTRATION]: byMethod({ GET: REGISTERED, DELETE: refusalAnswer(409, reason) }),
      })

      await user.click(await screen.findByRole('button', { name: 'Cancelar inscrição' }))
      await user.click(screen.getByRole('button', { name: 'Sim, cancelar' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(text)
      expect(screen.getByText('Você está na lista desde 5 de outubro de 2026.')).toBeInTheDocument()
    })

    it('gives the generic refusal when the 409 of the cancel has no reason', async () => {
      const { user } = renderEventPage({
        [EVENT]: jsonAnswer(DINNER),
        [REGISTRATION]: byMethod({ GET: REGISTERED, DELETE: problemAnswer(409) }),
      })

      await user.click(await screen.findByRole('button', { name: 'Cancelar inscrição' }))
      await user.click(screen.getByRole('button', { name: 'Sim, cancelar' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'A inscrição não pode mais ser cancelada: o evento já começou ou terminou.',
      )
    })

    it.each([503, 429])('keeps the registration and asks to wait on a %s of the cancel', async (status) => {
      const { user } = renderEventPage({
        [EVENT]: jsonAnswer(DINNER),
        [REGISTRATION]: byMethod({ GET: REGISTERED, DELETE: busyAnswer(status) }),
      })

      await user.click(await screen.findByRole('button', { name: 'Cancelar inscrição' }))
      await user.click(screen.getByRole('button', { name: 'Sim, cancelar' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Tente de novo em 3 segundos.')
      expect(screen.getByText('Você está na lista desde 5 de outubro de 2026.')).toBeInTheDocument()
    })
  })

  it('says a cancelled event was cancelled, without reading the registration', async () => {
    const { fetchMock } = renderEventPage({ [EVENT]: jsonAnswer({ ...DINNER, status: 'CANCELLED' }) })

    expect(await screen.findByText('Este evento foi cancelado.')).toBeInTheDocument()
    expect(screen.getByText('Cancelado')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith(REGISTRATION, expect.anything())
  })

  it('says an ended event ended', async () => {
    vi.setSystemTime(AFTER_EVENT)
    renderEventPage({ [EVENT]: jsonAnswer(DINNER) })

    expect(await screen.findByText('Este evento já terminou.')).toBeInTheDocument()
    expect(screen.getByText('Encerrado')).toBeInTheDocument()
  })

  describe('during the event', () => {
    const PAIRING = `${EVENT}/rounds`

    beforeEach(() => {
      vi.setSystemTime(DURING_EVENT)
    })

    it('says the registrations are closed to who is not registered', async () => {
      renderEventPage({ [EVENT]: jsonAnswer(DINNER), [REGISTRATION]: NOT_REGISTERED })

      expect(await screen.findByText('O evento já começou, e as inscrições estão fechadas.')).toBeInTheDocument()
      expect(screen.getByText('Em andamento')).toBeInTheDocument()
    })

    it('offers to try again when the registration could not be read', async () => {
      const { user } = renderEventPage({
        [EVENT]: jsonAnswer(DINNER),
        [REGISTRATION]: inSequence(problemAnswer(500), REGISTERED),
      })

      expect(await screen.findByText('Não foi possível verificar sua inscrição.')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))

      expect(await screen.findByRole('button', { name: 'Ver minha dupla' })).toBeInTheDocument()
    })

    it('shows the partner of the round the person asks for, by the end of the account id', async () => {
      const { user } = renderEventPage({
        [EVENT]: jsonAnswer(DINNER),
        [REGISTRATION]: REGISTERED,
        [`${PAIRING}/1/pairing`]: pairingAnswer(1, '0199a1d2-1111-7aaa-8bbb-cccc1a2b3c4d'),
        [`${PAIRING}/1/decision`]: problemAnswer(404),
      })

      expect(await screen.findByLabelText('Rodada')).toHaveValue('1')
      await user.click(screen.getByRole('button', { name: 'Ver minha dupla' }))

      expect(await screen.findByText('Sua dupla na rodada 1 é a conta 1a2b3c4d.')).toBeInTheDocument()
    })

    it('goes to the next round and says when the person sits it out', async () => {
      const { user } = renderEventPage({
        [EVENT]: jsonAnswer(DINNER),
        [REGISTRATION]: REGISTERED,
        [`${PAIRING}/1/pairing`]: pairingAnswer(1, '0199a1d2-1111-7aaa-8bbb-cccc1a2b3c4d'),
        [`${PAIRING}/1/decision`]: problemAnswer(404),
        [`${PAIRING}/2/pairing`]: pairingAnswer(2, null),
      })
      await user.click(await screen.findByRole('button', { name: 'Ver minha dupla' }))

      await user.click(await screen.findByRole('button', { name: 'Ver a rodada 2' }))

      expect(
        await screen.findByText('Na rodada 2 você ficou de fora. Na próxima, quem ficou de fora tem prioridade.'),
      ).toBeInTheDocument()
      expect(screen.getByLabelText('Rodada')).toHaveValue('2')
    })

    it('says a round has not started or did not include the person on 404, and asks again on a new click', async () => {
      const { fetchMock, user } = renderEventPage({
        [EVENT]: jsonAnswer(DINNER),
        [REGISTRATION]: REGISTERED,
        [`${PAIRING}/3/pairing`]: inSequence(problemAnswer(404), pairingAnswer(3, null)),
      })
      const field = await screen.findByLabelText('Rodada')
      await user.clear(field)
      await user.type(field, '3')
      await user.click(screen.getByRole('button', { name: 'Ver minha dupla' }))
      expect(await screen.findByText('A rodada 3 ainda não começou, ou você não estava nela.')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Ver minha dupla' }))

      expect(await screen.findByText(/Na rodada 3 você ficou de fora/)).toBeInTheDocument()
      expect(callsTo(fetchMock, `${PAIRING}/3/pairing`, 'GET')).toHaveLength(2)
    })

    it.each(['0', '101', '', 'um'])('refuses the round %j without asking the API', async (text) => {
      const { fetchMock, user } = renderEventPage({ [EVENT]: jsonAnswer(DINNER), [REGISTRATION]: REGISTERED })
      const field = await screen.findByLabelText('Rodada')
      await user.clear(field)
      if (text !== '') {
        await user.type(field, text)
      }

      await user.click(screen.getByRole('button', { name: 'Ver minha dupla' }))

      expect(field).toHaveAttribute('aria-invalid', 'true')
      expect(field).toHaveAccessibleDescription('Informe um número de rodada de 1 a 100.')
      expect(fetchMock.mock.calls.some(([path]) => String(path).includes('/rounds/'))).toBe(false)
    })

    it('offers to try again when the pairing could not be read', async () => {
      const { user } = renderEventPage({
        [EVENT]: jsonAnswer(DINNER),
        [REGISTRATION]: REGISTERED,
        [`${PAIRING}/1/pairing`]: inSequence(problemAnswer(500), pairingAnswer(1, null)),
      })
      await user.click(await screen.findByRole('button', { name: 'Ver minha dupla' }))

      expect(await screen.findByText('Não foi possível ver sua dupla na rodada 1.')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))

      expect(await screen.findByText(/Na rodada 1 você ficou de fora/)).toBeInTheDocument()
    })

    it('says it is looking for the partner while the API answers', async () => {
      const { user } = renderEventPage({
        [EVENT]: jsonAnswer(DINNER),
        [REGISTRATION]: REGISTERED,
        [`${PAIRING}/1/pairing`]: neverAnswer(),
      })

      await user.click(await screen.findByRole('button', { name: 'Ver minha dupla' }))

      expect(await screen.findByText('Procurando sua dupla na rodada 1…')).toBeInTheDocument()
    })

    it('gives every link, button and field a 44px touch target', async () => {
      const { user } = renderEventPage({
        [EVENT]: jsonAnswer(DINNER),
        [REGISTRATION]: REGISTERED,
        [`${PAIRING}/1/pairing`]: pairingAnswer(1, null),
      })
      await user.click(await screen.findByRole('button', { name: 'Ver minha dupla' }))
      await screen.findByRole('button', { name: 'Ver a rodada 2' })

      expect(elementsWithoutTouchTarget(screen.getByRole('main'))).toEqual([])
    })
  })

  it('gives every link and button a 44px touch target before the event', async () => {
    const { user } = renderEventPage({ [EVENT]: jsonAnswer(DINNER), [REGISTRATION]: REGISTERED })
    await user.click(await screen.findByRole('button', { name: 'Cancelar inscrição' }))

    expect(elementsWithoutTouchTarget(screen.getByRole('main'))).toEqual([])
  })
})
