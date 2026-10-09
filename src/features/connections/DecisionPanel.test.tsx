import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../app/App.tsx'
import { DINNER, emptyChatRoutes, SESSION } from '../../test/eventFixtures.ts'
import {
  byMethod,
  inSequence,
  jsonAnswer,
  networkFailure,
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
const ROUNDS = `${EVENT}/rounds`
const DECISION = `${ROUNDS}/1/decision`
const CONNECTIONS = '/api/me/connections'
const PARTNER_ID = '0199a1d2-1111-7aaa-8bbb-cccc1a2b3c4d'

/** Durante o jantar (19:00 às 22:00 em Brasília). */
const DURING_EVENT = new Date('2026-10-10T23:00:00Z')
const DECIDED_AT = '2026-10-10T23:30:00Z'

const NOT_DECIDED = problemAnswer(404)

function decisionAnswer(interested: boolean, status = 200, extra: object = {}): FakeRoute {
  return jsonAnswer({ eventId: DINNER.id, roundNumber: 1, interested, decidedAt: DECIDED_AT, ...extra }, status)
}

function waitAnswer(status: number, retryAfter?: string): FakeRoute {
  return () =>
    Promise.resolve(
      new Response(null, { status, headers: retryAfter === undefined ? {} : { 'Retry-After': retryAfter } }),
    )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(DURING_EVENT)
})

afterEach(() => {
  vi.useRealTimers()
  window.history.replaceState(null, '', '/')
  document.cookie = 'XSRF-TOKEN=; path=/; max-age=0'
})

/** Abre o evento em andamento, como inscrita, na rodada atual (a 1, salvo `currentRound`). */
async function openRound(
  decision: FakeRoute,
  more: Readonly<Record<string, FakeRoute>> = {},
  partner: string | null = PARTNER_ID,
  currentRound = 1,
) {
  stubMatchMedia(false)
  window.history.replaceState(null, '', `/eventos/${DINNER.id}`)
  const fetchMock = stubApi({
    ...SESSION,
    [EVENT]: jsonAnswer({ ...DINNER, currentRound }),
    [`${EVENT}/registration`]: jsonAnswer({ eventId: DINNER.id, registeredAt: '2026-10-05T12:00:00Z' }),
    [`${ROUNDS}/1/pairing`]: jsonAnswer({ eventId: DINNER.id, roundNumber: 1, partnerAccountId: partner }),
    [`${ROUNDS}/2/pairing`]: jsonAnswer({ eventId: DINNER.id, roundNumber: 2, partnerAccountId: PARTNER_ID }),
    [`${ROUNDS}/2/decision`]: NOT_DECIDED,
    [DECISION]: decision,
    ...emptyChatRoutes(currentRound),
    ...more,
  })
  render(<App />)
  const user = userEvent.setup()
  await screen.findByText(/Sua dupla na rodada|você ficou de fora/)
  return { fetchMock, user }
}

function panel(): HTMLElement {
  return screen.getByRole('region', { name: 'Continuar em contato?' })
}

async function findPanel(): Promise<HTMLElement> {
  return screen.findByRole('region', { name: 'Continuar em contato?' })
}

function putsTo(fetchMock: ReturnType<typeof stubApi>) {
  return fetchMock.mock.calls.filter(([path, init]) => path === DECISION && init?.method === 'PUT')
}

async function chooseAndConfirm(user: ReturnType<typeof userEvent.setup>, choice: string) {
  await user.click(await within(await findPanel()).findByRole('button', { name: choice }))
  await user.click(within(panel()).getByRole('button', { name: 'Confirmar minha decisão' }))
}

describe('private decision after a round', () => {
  it('offers the choice with the promise that it is private and only a double yes connects', async () => {
    await openRound(NOT_DECIDED)

    const region = await findPanel()
    expect(
      within(region).getByText(
        'Só você vê sua resposta: a outra pessoa nunca fica sabendo o que você escolheu. Se as duas quiserem, vocês viram uma conexão.',
      ),
    ).toBeInTheDocument()
    expect(within(region).getByRole('button', { name: 'Quero continuar em contato' })).toBeEnabled()
    expect(within(region).getByRole('button', { name: 'Não quero' })).toBeEnabled()
  })

  it('offers no decision when the person sat the round out', async () => {
    const { fetchMock } = await openRound(neverAnswer(), {}, null)

    expect(await screen.findByText(/você ficou de fora/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Continuar em contato?' })).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([path]) => path === DECISION)).toBe(false)
  })

  it('says it is reading the own decision while the API answers', async () => {
    await openRound(neverAnswer())

    expect(await within(await findPanel()).findByText('Verificando sua decisão…')).toHaveAttribute('role', 'status')
  })

  it('offers to try again when the own decision could not be read', async () => {
    const { user } = await openRound(inSequence(problemAnswer(500), decisionAnswer(false)))

    expect(await within(await findPanel()).findByText('Não foi possível ver sua decisão.')).toBeInTheDocument()
    await user.click(within(panel()).getByRole('button', { name: 'Tentar de novo' }))

    expect(await within(panel()).findByText('Sua decisão: você não quer continuar em contato.')).toBeInTheDocument()
  })

  it('asks to confirm before sending, saying the decision is final and private, with the focus on confirm', async () => {
    const { fetchMock, user } = await openRound(NOT_DECIDED)

    await user.click(await within(await findPanel()).findByRole('button', { name: 'Quero continuar em contato' }))

    expect(within(panel()).getByText('Você escolheu: quero continuar em contato.')).toBeInTheDocument()
    expect(
      within(panel()).getByText('A decisão é final: depois de confirmar, não dá para mudar. Ela continua só sua.'),
    ).toBeInTheDocument()
    expect(within(panel()).getByRole('button', { name: 'Confirmar minha decisão' })).toHaveFocus()
    expect(putsTo(fetchMock)).toHaveLength(0)
  })

  it('goes back to the choice without sending, with the focus on the option chosen before', async () => {
    const { fetchMock, user } = await openRound(NOT_DECIDED)
    await user.click(await within(await findPanel()).findByRole('button', { name: 'Não quero' }))
    expect(within(panel()).getByText('Você escolheu: não quero continuar em contato.')).toBeInTheDocument()

    await user.click(within(panel()).getByRole('button', { name: 'Voltar' }))

    expect(within(panel()).getByRole('button', { name: 'Não quero' })).toHaveFocus()
    expect(putsTo(fetchMock)).toHaveLength(0)
  })

  it.each([
    ['Quero continuar em contato', true, 'Sua decisão: você quer continuar em contato.'],
    ['Não quero', false, 'Sua decisão: você não quer continuar em contato.'],
  ])('records "%s" and shows the own decision', async (choice, interested, shownText) => {
    const { fetchMock, user } = await openRound(byMethod({ GET: NOT_DECIDED, PUT: decisionAnswer(interested, 201) }))

    await chooseAndConfirm(user, choice)

    const recorded = await within(panel()).findByText('Decisão registrada.')
    expect(recorded.closest('[role="status"]')).toHaveFocus()
    expect(within(panel()).getByText(shownText)).toBeInTheDocument()
    expect(putsTo(fetchMock)[0]?.[1]?.body).toBe(JSON.stringify({ interested }))
    expect(within(panel()).queryByRole('button', { name: choice })).not.toBeInTheDocument()
  })

  it('says it is recording while the API answers, without a second click', async () => {
    const { user } = await openRound(byMethod({ GET: NOT_DECIDED, PUT: neverAnswer() }))

    await chooseAndConfirm(user, 'Não quero')

    expect(within(panel()).getByRole('button', { name: 'Registrando…' })).toBeDisabled()
    expect(within(panel()).getByRole('button', { name: 'Voltar' })).toBeDisabled()
  })

  it('shows a decision already made, final, with the way to the connections after a yes', async () => {
    await openRound(decisionAnswer(true))

    const region = await findPanel()
    expect(await within(region).findByText('Sua decisão: você quer continuar em contato.')).toBeInTheDocument()
    expect(
      within(region).getByText('Registrada em 10 de outubro de 2026. A decisão é final, e só você a vê.'),
    ).toBeInTheDocument()
    expect(
      within(region).getByText('Se a outra pessoa também quiser, a conexão aparece em Conexões.'),
    ).toBeInTheDocument()
    expect(within(region).getByRole('link', { name: 'Ver minhas conexões' })).toHaveAttribute('href', '/conexoes')
    expect(within(region).queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows a no already made without the way to the connections', async () => {
    await openRound(decisionAnswer(false))

    expect(
      await within(await findPanel()).findByText('Sua decisão: você não quer continuar em contato.'),
    ).toBeInTheDocument()
    expect(within(panel()).queryByRole('link')).not.toBeInTheDocument()
  })

  it('reads the decision of each round on its own', async () => {
    const { user } = await openRound(decisionAnswer(true), {}, PARTNER_ID, 2)
    expect(await within(await findPanel()).findByRole('button', { name: 'Não quero' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Rodada anterior' }))

    expect(
      await within(await findPanel()).findByText('Sua decisão: você quer continuar em contato.'),
    ).toBeInTheDocument()
    expect(within(panel()).queryByRole('button', { name: 'Não quero' })).not.toBeInTheDocument()
  })

  describe('failures when recording', () => {
    it('on 409 says the decision was already made and is final, and shows the one that counts', async () => {
      const { user } = await openRound(
        byMethod({
          GET: inSequence(NOT_DECIDED, decisionAnswer(false)),
          PUT: refusalAnswer(409, 'DECISION_ALREADY_MADE'),
        }),
      )

      await chooseAndConfirm(user, 'Quero continuar em contato')

      expect(await within(panel()).findByRole('alert')).toHaveTextContent(
        'Você já tinha decidido nesta rodada, e a decisão é final. Esta é a que vale.',
      )
      expect(await within(panel()).findByText('Sua decisão: você não quer continuar em contato.')).toBeInTheDocument()
    })

    it('on a 409 without the reason says only that it could not record, not that it was already decided', async () => {
      const { user } = await openRound(byMethod({ GET: NOT_DECIDED, PUT: problemAnswer(409) }))

      await chooseAndConfirm(user, 'Não quero')

      const alert = await within(panel()).findByRole('alert')
      expect(alert).toHaveTextContent('Não foi possível registrar sua decisão. Tente de novo.')
      expect(alert).not.toHaveTextContent('já tinha decidido')
    })

    it('on 404 says there is nothing to decide in this round', async () => {
      const { user } = await openRound(byMethod({ GET: NOT_DECIDED, PUT: problemAnswer(404) }))

      await chooseAndConfirm(user, 'Não quero')

      expect(await within(panel()).findByRole('alert')).toHaveTextContent(
        'Não há o que decidir: você não formou dupla nesta rodada.',
      )
    })

    it.each([
      [503, '3', 'Não foi possível registrar agora. Tente de novo em 3 segundos.'],
      [429, '1', 'Não foi possível registrar agora. Tente de novo em 1 segundo.'],
      [503, undefined, 'Não foi possível registrar agora. Tente de novo em instantes.'],
    ])('on %i with Retry-After %s asks to wait, keeping the confirmation to try again', async (status, retry, text) => {
      const { fetchMock, user } = await openRound(
        byMethod({ GET: NOT_DECIDED, PUT: inSequence(waitAnswer(status, retry), decisionAnswer(false, 201)) }),
      )

      await chooseAndConfirm(user, 'Não quero')
      expect(await within(panel()).findByRole('alert')).toHaveTextContent(text)
      expect(within(panel()).getByRole('button', { name: 'Confirmar minha decisão' })).toBeEnabled()
      await user.click(within(panel()).getByRole('button', { name: 'Confirmar minha decisão' }))

      expect(await within(panel()).findByText('Decisão registrada.')).toBeInTheDocument()
      expect(putsTo(fetchMock)).toHaveLength(2)
    })

    it('on 401 asks to sign in again', async () => {
      const { user } = await openRound(byMethod({ GET: NOT_DECIDED, PUT: statusAnswer(401) }))

      await chooseAndConfirm(user, 'Não quero')

      const alert = await within(panel()).findByRole('alert')
      expect(alert).toHaveTextContent('Sua sessão terminou. Entre de novo para continuar.')
      expect(within(alert).getByRole('link', { name: 'Entrar de novo' })).toHaveAttribute(
        'href',
        '/oauth2/authorization/entra',
      )
    })

    it('keeps a single primary button while the notice asks to sign in again', async () => {
      const { user } = await openRound(byMethod({ GET: NOT_DECIDED, PUT: statusAnswer(401) }))
      await user.click(await within(await findPanel()).findByRole('button', { name: 'Não quero' }))
      expect(within(panel()).getByRole('button', { name: 'Confirmar minha decisão' }).className).toBe(PRIMARY_BUTTON)

      await user.click(within(panel()).getByRole('button', { name: 'Confirmar minha decisão' }))

      expect((await within(panel()).findByRole('link', { name: 'Entrar de novo' })).className).toBe(PRIMARY_BUTTON)
      expect(within(panel()).getByRole('button', { name: 'Confirmar minha decisão' }).className).toBe(SECONDARY_BUTTON)
    })

    it.each([
      ['a server error', problemAnswer(500)],
      ['a network failure', networkFailure()],
    ])('on %s asks to try again', async (_case, answer) => {
      const { user } = await openRound(byMethod({ GET: NOT_DECIDED, PUT: answer }))

      await chooseAndConfirm(user, 'Não quero')

      expect(await within(panel()).findByRole('alert')).toHaveTextContent(
        'Não foi possível registrar sua decisão. Tente de novo.',
      )
    })
  })

  describe('privacy of the partner', () => {
    /**
     * O front não recebe a decisão do par. Se um dia a resposta trouxer algo sobre ele, ou a conexão já
     * existir, nada na tela pode mudar: o texto do painel depende só da própria decisão.
     */
    it.each([
      ['nothing about the partner', {}, []],
      ['a partner yes smuggled in the body', { partnerInterested: true, connected: true }, []],
      ['a partner no smuggled in the body', { partnerInterested: false, connected: false }, []],
      ['the connection already in the list', {}, [{ accountId: PARTNER_ID, connectedAt: DECIDED_AT }]],
    ])('shows the same text after a yes with %s', async (_case, extra, connections) => {
      const { fetchMock } = await openRound(decisionAnswer(true, 200, extra), {
        [CONNECTIONS]: jsonAnswer({ items: connections, nextPageToken: null }),
      })
      await within(await findPanel()).findByText('Sua decisão: você quer continuar em contato.')

      expect(panel()).toHaveTextContent(
        [
          'Continuar em contato?',
          'Sua decisão: você quer continuar em contato.',
          'Registrada em 10 de outubro de 2026. A decisão é final, e só você a vê.',
          'Se a outra pessoa também quiser, a conexão aparece em Conexões.',
          'Ver minhas conexões',
        ].join(''),
        { normalizeWhitespace: true },
      )
      expect(fetchMock.mock.calls.some(([path]) => String(path).startsWith(CONNECTIONS))).toBe(false)
    })

    it.each([
      ['nothing about the partner', {}],
      ['a partner yes smuggled in the body', { partnerInterested: true, connected: true }],
    ])('says only "recorded" after confirming a yes with %s', async (_case, extra) => {
      const { user } = await openRound(byMethod({ GET: NOT_DECIDED, PUT: decisionAnswer(true, 201, extra) }))

      await chooseAndConfirm(user, 'Quero continuar em contato')

      expect(await within(panel()).findByRole('status')).toHaveTextContent(/^Decisão registrada\.$/)
    })
  })

  it('gives every link and button a 44px touch target', async () => {
    const { user } = await openRound(NOT_DECIDED)
    await user.click(await within(await findPanel()).findByRole('button', { name: 'Não quero' }))

    expect(elementsWithoutTouchTarget(panel())).toEqual([])
    await waitFor(() => expect(elementsWithoutTouchTarget(screen.getByRole('main'))).toEqual([]))
  })
})
