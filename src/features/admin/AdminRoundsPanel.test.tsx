import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../app/App.tsx'
import { adminRound, ADMIN_PUBLISHED, AFTER_DINNER, BEFORE_DINNER, DURING_DINNER } from '../../test/adminFixtures.ts'
import { DINNER, SESSION } from '../../test/eventFixtures.ts'
import {
  byMethod,
  inSequence,
  jsonAnswer,
  neverAnswer,
  problemAnswer,
  refusalAnswer,
  stubApi,
  type FakeRoute,
} from '../../test/fakeApi.ts'
import { stubMatchMedia } from '../../test/fakeMatchMedia.ts'
import { elementsWithoutTouchTarget } from '../../test/touchTarget.ts'

const ADMIN_EVENT = `/api/admin/events/${ADMIN_PUBLISHED.id}`
const PUBLIC_EVENT = `/api/events/${DINNER.id}`
const ROUNDS = `${ADMIN_EVENT}/rounds`

/** O evento público com a última rodada iniciada (`null` antes da primeira). */
function inRound(currentRound: number | null): FakeRoute {
  return jsonAnswer({ ...DINNER, currentRound })
}

function busyAnswer(status: number, retryAfter = '30'): FakeRoute {
  return () => Promise.resolve(new Response(null, { status, headers: { 'Retry-After': retryAfter } }))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(DURING_DINNER)
})

afterEach(() => {
  vi.useRealTimers()
  window.history.replaceState(null, '', '/')
  document.cookie = 'XSRF-TOKEN=; path=/; max-age=0'
})

function renderRounds(routes: Readonly<Record<string, FakeRoute>>, event: object = ADMIN_PUBLISHED) {
  stubMatchMedia(false)
  window.history.replaceState(null, '', `/admin/eventos/${ADMIN_PUBLISHED.id}`)
  const fetchMock = stubApi({ ...SESSION, [ADMIN_EVENT]: jsonAnswer(event), ...routes })
  render(<App />)
  return { fetchMock, user: userEvent.setup() }
}

function callsTo(fetchMock: ReturnType<typeof stubApi>, path: string, method: string) {
  return fetchMock.mock.calls.filter(([calledPath, init]) => calledPath === path && (init?.method ?? 'GET') === method)
}

async function askToStart(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Iniciar rodada' }))
}

async function startRefusedBy(answer: FakeRoute, extra: Readonly<Record<string, FakeRoute>> = {}) {
  const rendered = renderRounds({
    [PUBLIC_EVENT]: inRound(null),
    [`${ROUNDS}/1`]: byMethod({ PUT: answer }),
    ...extra,
  })
  await askToStart(rendered.user)
  await rendered.user.click(screen.getByRole('button', { name: 'Sim, iniciar a rodada 1' }))
  return rendered
}

describe('rounds of the admin event page', () => {
  describe('before the first round', () => {
    it('says no round started and suggests the first number, as a field the admin can change', async () => {
      renderRounds({ [PUBLIC_EVENT]: inRound(null) })

      expect(await screen.findByText('Nenhuma rodada começou ainda.')).toBeInTheDocument()
      expect(screen.getByLabelText('Número da rodada')).toHaveValue('1')
      expect(screen.getByLabelText('Número da rodada')).toHaveAccessibleDescription(/De 1 a 100/)
    })

    it('shows that it is looking for the current round', async () => {
      renderRounds({ [PUBLIC_EVENT]: neverAnswer() })

      expect(await screen.findByText('Vendo qual é a rodada atual…')).toBeInTheDocument()
    })

    it('offers to try again when the current round could not be read', async () => {
      const { user } = renderRounds({ [PUBLIC_EVENT]: inSequence(problemAnswer(500), inRound(null)) })

      expect(await screen.findByText('Não foi possível ver qual é a rodada atual.')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))

      expect(await screen.findByText('Nenhuma rodada começou ainda.')).toBeInTheDocument()
    })

    it('keeps every control with a touch target of 44px', async () => {
      renderRounds({ [PUBLIC_EVENT]: inRound(null) })
      await screen.findByRole('button', { name: 'Iniciar rodada' })

      expect(elementsWithoutTouchTarget(document.body)).toEqual([])
    })
  })

  describe('with rounds already started', () => {
    it('suggests the round after the current one and shows the counts of the current one', async () => {
      renderRounds({ [PUBLIC_EVENT]: inRound(2), [`${ROUNDS}/2`]: jsonAnswer(adminRound(2, 5, 2)) })

      expect(await screen.findByText('Rodada atual: 2')).toBeInTheDocument()
      expect(screen.getByText('5 pares; 2 pessoas ficaram de fora.')).toBeInTheDocument()
      expect(screen.getByText('Começou às 20:15.')).toBeInTheDocument()
      expect(screen.getByLabelText('Número da rodada')).toHaveValue('3')
    })

    it('shows only counts, never who is paired', async () => {
      renderRounds({
        [PUBLIC_EVENT]: inRound(1),
        [`${ROUNDS}/1`]: jsonAnswer({ ...adminRound(1), pairs: [{ a: 'conta-1', b: 'conta-2' }] }),
      })

      await screen.findByText('Rodada atual: 1')

      expect(document.body).not.toHaveTextContent('conta-1')
    })

    it('says the result is not available when the round of the event cannot be found', async () => {
      renderRounds({ [PUBLIC_EVENT]: inRound(2), [`${ROUNDS}/2`]: problemAnswer(404) })

      expect(await screen.findByText('Rodada atual: 2. O resultado ainda não está disponível.')).toBeInTheDocument()
    })

    it('offers to try again when the result of the round could not be read', async () => {
      const { user } = renderRounds({
        [PUBLIC_EVENT]: inRound(2),
        [`${ROUNDS}/2`]: inSequence(problemAnswer(500), jsonAnswer(adminRound(2))),
      })

      expect(await screen.findByText('Não foi possível ver o resultado da rodada 2.')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))

      expect(await screen.findByText('Rodada atual: 2')).toBeInTheDocument()
    })

    it('says there is no next round after the last one', async () => {
      renderRounds({ [PUBLIC_EVENT]: inRound(100), [`${ROUNDS}/100`]: jsonAnswer(adminRound(100)) })

      expect(await screen.findByText('Todas as 100 rodadas já começaram.')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Iniciar rodada' })).not.toBeInTheDocument()
    })
  })

  describe('starting a round', () => {
    it('asks to confirm with the number of registrations, before sending anything', async () => {
      const { fetchMock, user } = renderRounds({ [PUBLIC_EVENT]: inRound(null) })

      await askToStart(user)

      expect(
        screen.getByText(
          'Iniciar a rodada 1? Os pares são sorteados agora entre as 12 pessoas inscritas e o sorteio não se desfaz.',
        ),
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Sim, iniciar a rodada 1' })).toHaveFocus()
      expect(callsTo(fetchMock, `${ROUNDS}/1`, 'PUT')).toHaveLength(0)
    })

    it('goes back to the number field with what was typed, without sending anything', async () => {
      const { fetchMock, user } = renderRounds({ [PUBLIC_EVENT]: inRound(null) })
      await user.clear(await screen.findByLabelText('Número da rodada'))
      await user.type(screen.getByLabelText('Número da rodada'), '4')
      await user.click(screen.getByRole('button', { name: 'Iniciar rodada' }))

      await user.click(screen.getByRole('button', { name: 'Voltar' }))

      expect(screen.getByLabelText('Número da rodada')).toHaveFocus()
      expect(screen.getByLabelText('Número da rodada')).toHaveValue('4')
      expect(callsTo(fetchMock, `${ROUNDS}/4`, 'PUT')).toHaveLength(0)
    })

    it('starts the next round with the CSRF token and no body, then shows its result and the next number', async () => {
      document.cookie = 'XSRF-TOKEN=csrf-123; path=/'
      const { fetchMock, user } = renderRounds({
        [PUBLIC_EVENT]: inSequence(inRound(null), inRound(1)),
        // A leitura da rodada nunca responde: o resultado na tela é o da resposta do PUT.
        [`${ROUNDS}/1`]: byMethod({ PUT: jsonAnswer(adminRound(1, 6, 0), 201), GET: neverAnswer() }),
      })
      await askToStart(user)

      await user.click(screen.getByRole('button', { name: 'Sim, iniciar a rodada 1' }))

      const notice = await screen.findByRole('status')
      expect(notice).toHaveTextContent('Rodada 1 iniciada. Cada pessoa já pode ver a própria dupla.')
      expect(notice).toHaveFocus()
      expect(await screen.findByText('6 pares; 0 pessoas ficaram de fora.')).toBeInTheDocument()
      expect(screen.getByLabelText('Número da rodada')).toHaveValue('2')
      const [put] = callsTo(fetchMock, `${ROUNDS}/1`, 'PUT')
      expect(put?.[1]?.body).toBeUndefined()
      expect(new Headers(put?.[1]?.headers).get('X-XSRF-TOKEN')).toBe('csrf-123')
    })

    it('starts the number the admin typed instead of the suggestion', async () => {
      const { fetchMock, user } = renderRounds({
        [PUBLIC_EVENT]: inRound(2),
        [`${ROUNDS}/2`]: jsonAnswer(adminRound(2)),
        [`${ROUNDS}/5`]: byMethod({ PUT: refusalAnswer(409, 'ROUND_OUT_OF_SEQUENCE') }),
      })
      await user.clear(await screen.findByLabelText('Número da rodada'))
      await user.type(screen.getByLabelText('Número da rodada'), '5')
      await askToStart(user)

      await user.click(screen.getByRole('button', { name: 'Sim, iniciar a rodada 5' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Não dá para iniciar a rodada 5: a anterior ainda não começou.',
      )
      expect(callsTo(fetchMock, `${ROUNDS}/5`, 'PUT')).toHaveLength(1)
    })

    it('tells a repeated round apart, with no new draw', async () => {
      const { user } = renderRounds({
        [PUBLIC_EVENT]: inRound(null),
        [`${ROUNDS}/1`]: byMethod({ PUT: jsonAnswer(adminRound(1), 200), GET: jsonAnswer(adminRound(1)) }),
      })
      await askToStart(user)

      await user.click(screen.getByRole('button', { name: 'Sim, iniciar a rodada 1' }))

      expect(await screen.findByRole('status')).toHaveTextContent('A rodada 1 já tinha sido iniciada. Esta é a mesma, sem novo sorteio.')
    })

    it('says it is starting and blocks a second click meanwhile', async () => {
      const { fetchMock, user } = renderRounds({
        [PUBLIC_EVENT]: inRound(null),
        [`${ROUNDS}/1`]: byMethod({ PUT: neverAnswer() }),
      })
      await askToStart(user)

      await user.click(screen.getByRole('button', { name: 'Sim, iniciar a rodada 1' }))

      await waitFor(() => expect(screen.getByRole('button', { name: 'Iniciando…' })).toBeDisabled())
      expect(callsTo(fetchMock, `${ROUNDS}/1`, 'PUT')).toHaveLength(1)
    })

    it.each(['', '0', '101', 'abc', '2.5', '-1'])('refuses the number %j without sending anything', async (typed) => {
      const { fetchMock, user } = renderRounds({ [PUBLIC_EVENT]: inRound(null) })
      const field = await screen.findByLabelText('Número da rodada')
      await user.clear(field)
      if (typed !== '') {
        await user.type(field, typed)
      }

      await user.click(screen.getByRole('button', { name: 'Iniciar rodada' }))

      expect(screen.getByText('Informe um número de 1 a 100.')).toBeInTheDocument()
      expect(field).toBeInvalid()
      expect(field).toHaveFocus()
      expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(0)
    })

    it.each([
      ['100', 'Sim, iniciar a rodada 100'],
      ['1', 'Sim, iniciar a rodada 1'],
    ])('accepts the number %s', async (typed, confirm) => {
      const { user } = renderRounds({ [PUBLIC_EVENT]: inRound(null) })
      const field = await screen.findByLabelText('Número da rodada')
      await user.clear(field)
      await user.type(field, typed)

      await user.click(screen.getByRole('button', { name: 'Iniciar rodada' }))

      expect(screen.getByRole('button', { name: confirm })).toBeInTheDocument()
    })
  })

  describe('when the API refuses', () => {
    it('explains EVENT_NOT_UNDERWAY and reads the event again', async () => {
      const { fetchMock } = await startRefusedBy(refusalAnswer(409, 'EVENT_NOT_UNDERWAY'))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Só dá para iniciar uma rodada com o evento publicado e em andamento.')
      expect(alert).toHaveFocus()
      await waitFor(() => expect(callsTo(fetchMock, ADMIN_EVENT, 'GET')).toHaveLength(2))
    })

    it('explains ROUND_OUT_OF_SEQUENCE and keeps the form to try another number', async () => {
      await startRefusedBy(refusalAnswer(409, 'ROUND_OUT_OF_SEQUENCE'))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Não dá para iniciar a rodada 1: a anterior ainda não começou. Inicie as rodadas em ordem.',
      )
      expect(screen.getByRole('button', { name: 'Iniciar rodada' })).toBeInTheDocument()
    })

    it.each([
      ['without a reason', problemAnswer(409)],
      ['with a reason the front does not know', refusalAnswer(409, 'FROM_THE_FUTURE')],
    ])('gives the generic refusal for a 409 %s', async (_name, answer) => {
      await startRefusedBy(answer)

      expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível iniciar a rodada: o evento mudou.')
    })

    it('tells the limit of rounds per hour and when to try again on a 429', async () => {
      await startRefusedBy(busyAnswer(429, '120'))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Você atingiu o limite de rodadas por hora. Tente de novo em 120 segundos.',
      )
    })

    it('tells that nothing was saved and when to try again on a 503', async () => {
      await startRefusedBy(busyAnswer(503, '1'))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Nada foi gravado. Tente de novo em 1 segundo.')
      expect(alert).not.toHaveTextContent('limite de rodadas por hora')
    })

    it('does not promise a wait when the API does not say how long', async () => {
      await startRefusedBy(() => Promise.resolve(new Response(null, { status: 429 })))

      expect(await screen.findByRole('alert')).toHaveTextContent('Tente de novo em instantes.')
    })

    it('says "Área só para a equipe." on a 403', async () => {
      await startRefusedBy(problemAnswer(403))

      expect(await screen.findByRole('alert')).toHaveTextContent('Área só para a equipe.')
    })

    it('offers to sign in again on a 401', async () => {
      await startRefusedBy(problemAnswer(401))

      expect(await screen.findByRole('link', { name: 'Entrar de novo' })).toBeInTheDocument()
    })

    it('says the event no longer exists on a 404', async () => {
      await startRefusedBy(problemAnswer(404))

      expect(await screen.findByRole('alert')).toHaveTextContent('Este evento não existe mais.')
    })

    it('says it is safe to try again after a server error', async () => {
      await startRefusedBy(problemAnswer(500))

      expect(await screen.findByRole('alert')).toHaveTextContent('repetir é seguro')
    })
  })

  describe('depending on the phase of the event', () => {
    it('says rounds begin after the start while the event is still to come', async () => {
      vi.setSystemTime(BEFORE_DINNER)
      renderRounds({})

      expect(await screen.findByText('As rodadas começam depois do horário de início do evento.')).toBeInTheDocument()
      expect(screen.queryByRole('form', { name: 'Iniciar rodada' })).not.toBeInTheDocument()
    })

    it('shows the last result but no longer offers to start once the event is over', async () => {
      vi.setSystemTime(AFTER_DINNER)
      renderRounds({ [PUBLIC_EVENT]: inRound(3), [`${ROUNDS}/3`]: jsonAnswer(adminRound(3, 8, 1)) })

      expect(await screen.findByText('Rodada atual: 3')).toBeInTheDocument()
      expect(screen.getByText('8 pares; 1 pessoa ficou de fora.')).toBeInTheDocument()
      expect(screen.getByText('O evento terminou, então não dá mais para iniciar rodadas.')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Iniciar rodada' })).not.toBeInTheDocument()
    })

    it('offers to start after refreshing once the event has begun', async () => {
      vi.setSystemTime(BEFORE_DINNER)
      const { user } = renderRounds({
        [PUBLIC_EVENT]: inRound(null),
        [ADMIN_EVENT]: jsonAnswer(ADMIN_PUBLISHED),
      })
      await screen.findByText('As rodadas começam depois do horário de início do evento.')

      vi.setSystemTime(DURING_DINNER)
      await user.click(screen.getByRole('button', { name: 'Atualizar' }))

      expect(await screen.findByRole('button', { name: 'Iniciar rodada' })).toBeInTheDocument()
    })
  })
})
