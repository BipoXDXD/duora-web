import { fireEvent, screen, waitFor } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ADMIN_DRAFT, BEFORE_DINNER } from '../../test/adminFixtures.ts'
import { SESSION } from '../../test/eventFixtures.ts'
import {
  ANONYMOUS_SESSION,
  byMethod,
  jsonAnswer,
  networkFailure,
  neverAnswer,
  problemAnswer,
  type stubApi,
  type FakeRoute,
} from '../../test/fakeApi.ts'
import { renderAppAt } from '../../test/renderApp.tsx'
import { elementsWithoutTouchTarget } from '../../test/touchTarget.ts'

const CREATE = '/api/admin/events'
const DRAFT_PATH = `${CREATE}/${ADMIN_DRAFT.id}`

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(BEFORE_DINNER)
})

afterEach(() => {
  vi.useRealTimers()
  window.history.replaceState(null, '', '/')
  document.cookie = 'XSRF-TOKEN=; path=/; max-age=0'
})

function renderNewEvent(routes: Readonly<Record<string, FakeRoute>>, session = SESSION) {
  return renderAppAt('/admin/eventos/novo', { ...session, ...routes })
}

function createCalls(fetchMock: ReturnType<typeof stubApi>) {
  return fetchMock.mock.calls.filter(([path, init]) => path === CREATE && init?.method === 'POST')
}

/** `datetime-local` aceita o valor por `change`; digitar caractere a caractere não funciona no jsdom. */
function setDateTime(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Título'), '  Jantar às cegas ')
  await user.type(screen.getByLabelText('Descrição'), 'Uma noite de jogos de mesa.')
  setDateTime('Início', '2026-10-10T19:00')
  setDateTime('Fim', '2026-10-10T22:00')
  await user.type(screen.getByLabelText('Capacidade'), '40')
}

function validRequestBody() {
  return {
    title: 'Jantar às cegas',
    description: 'Uma noite de jogos de mesa.',
    startsAt: '2026-10-10T19:00:00-03:00',
    endsAt: '2026-10-10T22:00:00-03:00',
    capacity: 40,
  }
}

const CREATED = jsonAnswer(ADMIN_DRAFT, 201)

describe('new event page', () => {
  it('asks a visitor who is not logged in to sign in, without showing the form', async () => {
    renderNewEvent({}, ANONYMOUS_SESSION)

    expect(await screen.findByText('Entre para criar um evento.')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Novo evento' })).not.toBeInTheDocument()
  })

  it('shows the form with the limits and the time zone of the user', async () => {
    renderNewEvent({})

    expect(await screen.findByLabelText('Título')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Novo evento' })).toHaveFocus()
    expect(screen.getByLabelText('Descrição')).toBeInTheDocument()
    expect(screen.getByLabelText('Início')).toHaveAttribute('type', 'datetime-local')
    expect(screen.getByLabelText('Fim')).toHaveAttribute('type', 'datetime-local')
    expect(screen.getByLabelText('Capacidade')).toBeInTheDocument()
    expect(screen.getByText(/Horário de America\/Sao_Paulo\. No futuro e em até 365 dias\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Criar rascunho' })).toBeEnabled()
  })

  it('keeps every control with a touch target of 44px', async () => {
    const { user } = renderNewEvent({})
    await user.click(await screen.findByRole('button', { name: 'Criar rascunho' }))

    expect(elementsWithoutTouchTarget(screen.getByRole('form', { name: 'Novo evento' }))).toEqual([])
  })

  describe('checks before sending', () => {
    it('shows a message in each empty field, focuses the first and sends nothing', async () => {
      const { fetchMock, user } = renderNewEvent({})

      await user.click(await screen.findByRole('button', { name: 'Criar rascunho' }))

      expect(screen.getByLabelText('Título')).toHaveFocus()
      expect(screen.getByLabelText('Título')).toHaveAccessibleDescription(/Dê um título ao evento\./)
      expect(screen.getByLabelText('Título')).toBeInvalid()
      expect(screen.getByText('Descreva o evento.')).toBeInTheDocument()
      expect(screen.getByText('Informe quando o evento começa.')).toBeInTheDocument()
      expect(screen.getByText('Informe quando o evento termina.')).toBeInTheDocument()
      expect(screen.getByText('Informe quantas pessoas podem se inscrever.')).toBeInTheDocument()
      expect(createCalls(fetchMock)).toHaveLength(0)
    })

    it.each([
      ['a start in the past', 'Início', '2026-10-01T19:00', 'O início precisa ser no futuro.'],
      ['an end before the start', 'Fim', '2026-10-10T18:00', 'O fim precisa ser depois do início.'],
      ['an event longer than 12 hours', 'Fim', '2026-10-11T08:00', 'O evento pode durar no máximo 12 horas.'],
    ])('refuses %s', async (_name, label, value, message) => {
      const { fetchMock, user } = renderNewEvent({})
      await fillValidForm(user)
      setDateTime(label, value)

      await user.click(screen.getByRole('button', { name: 'Criar rascunho' }))

      expect(screen.getByLabelText(label)).toHaveAccessibleDescription(new RegExp(message))
      expect(createCalls(fetchMock)).toHaveLength(0)
    })

    it.each([
      ['1', 'A capacidade mínima é de 2 pessoas.'],
      ['201', 'A capacidade máxima é de 200 pessoas.'],
      ['dez', 'Use só números inteiros, como 40.'],
    ])('refuses the capacity %j', async (capacity, message) => {
      const { fetchMock, user } = renderNewEvent({})
      await fillValidForm(user)
      await user.clear(screen.getByLabelText('Capacidade'))
      await user.type(screen.getByLabelText('Capacidade'), capacity)

      await user.click(screen.getByRole('button', { name: 'Criar rascunho' }))

      expect(screen.getByLabelText('Capacidade')).toHaveFocus()
      expect(screen.getByText(message)).toBeInTheDocument()
      expect(createCalls(fetchMock)).toHaveLength(0)
    })
  })

  describe('creating the draft', () => {
    it('sends the times with the offset of the user and the CSRF token, then opens the draft', async () => {
      document.cookie = 'XSRF-TOKEN=csrf-123; path=/'
      const { fetchMock, user } = renderNewEvent({
        [CREATE]: byMethod({ POST: CREATED }),
        [DRAFT_PATH]: jsonAnswer(ADMIN_DRAFT),
      })
      await fillValidForm(user)

      await user.click(screen.getByRole('button', { name: 'Criar rascunho' }))

      expect(await screen.findByRole('heading', { level: 1, name: 'Jantar às cegas' })).toBeInTheDocument()
      expect(window.location.pathname).toBe(`/admin/eventos/${ADMIN_DRAFT.id}`)
      const [post] = createCalls(fetchMock)
      expect(JSON.parse(String(post?.[1]?.body))).toEqual(validRequestBody())
      expect(new Headers(post?.[1]?.headers).get('X-XSRF-TOKEN')).toBe('csrf-123')
    })

    it('says it is creating and blocks a second click meanwhile', async () => {
      const { fetchMock, user } = renderNewEvent({ [CREATE]: byMethod({ POST: neverAnswer() }) })
      await fillValidForm(user)

      await user.click(screen.getByRole('button', { name: 'Criar rascunho' }))

      await waitFor(() => expect(screen.getByRole('button', { name: 'Criando…' })).toBeDisabled())
      expect(createCalls(fetchMock)).toHaveLength(1)
    })

    it('shows a message in each field the API refused with errors[], and focuses the first', async () => {
      const { user } = renderNewEvent({
        [CREATE]: byMethod({
          POST: problemAnswer(400, 'invalid', [
            { field: 'capacity', code: 'ABOVE_MAXIMUM' },
            { field: 'startsAt', code: 'BELOW_MINIMUM' },
            { field: 'title', code: 'FORBIDDEN_CHARACTER' },
          ]),
        }),
      })
      await fillValidForm(user)

      await user.click(screen.getByRole('button', { name: 'Criar rascunho' }))

      expect(await screen.findByText('Use uma linha só, sem caracteres invisíveis.')).toBeInTheDocument()
      expect(screen.getByText('O início precisa ser no futuro.')).toBeInTheDocument()
      expect(screen.getByText('A capacidade máxima é de 200 pessoas.')).toBeInTheDocument()
      expect(screen.getByLabelText('Título')).toHaveFocus()
      expect(screen.getByLabelText('Título')).toBeInvalid()
      expect(screen.getByLabelText('Descrição')).toBeValid()
      expect(screen.queryByText('Confira os dados do evento e tente de novo.')).not.toBeInTheDocument()
    })

    it('marks a field refused for a code it does not know as refused', async () => {
      const { user } = renderNewEvent({
        [CREATE]: byMethod({ POST: problemAnswer(400, 'invalid', [{ field: 'endsAt', code: 'FROM_THE_FUTURE' }]) }),
      })
      await fillValidForm(user)

      await user.click(screen.getByRole('button', { name: 'Criar rascunho' }))

      expect(await screen.findByText('Confira o fim.')).toBeInTheDocument()
      expect(screen.getByLabelText('Fim')).toHaveFocus()
    })

    it.each([
      ['an error of the whole body', [{ code: 'MALFORMED_BODY' }]],
      ['an unknown field', [{ field: 'visibility', code: 'UNKNOWN_FIELD' }]],
      ['no list of errors', undefined],
    ])('asks to check the data when the API sends %s', async (_name, errors) => {
      const { user } = renderNewEvent({ [CREATE]: byMethod({ POST: problemAnswer(400, 'invalid', errors) }) })
      await fillValidForm(user)

      await user.click(screen.getByRole('button', { name: 'Criar rascunho' }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Confira os dados do evento e tente de novo.')
      expect(alert).toHaveFocus()
    })

    it('warns about the whole form without taking the focus off the first refused field', async () => {
      const { user } = renderNewEvent({
        [CREATE]: byMethod({
          POST: problemAnswer(400, 'invalid', [
            { field: 'capacity', code: 'BELOW_MINIMUM' },
            { field: 'visibility', code: 'UNKNOWN_FIELD' },
          ]),
        }),
      })
      await fillValidForm(user)

      await user.click(screen.getByRole('button', { name: 'Criar rascunho' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Confira os dados do evento e tente de novo.')
      expect(screen.getByLabelText('Capacidade')).toHaveFocus()
      expect(screen.getByText('A capacidade mínima é de 2 pessoas.')).toBeInTheDocument()
    })

    it('keeps what was typed after a refusal', async () => {
      const { user } = renderNewEvent({
        [CREATE]: byMethod({ POST: problemAnswer(400, 'invalid', [{ field: 'capacity', code: 'BELOW_MINIMUM' }]) }),
      })
      await fillValidForm(user)

      await user.click(screen.getByRole('button', { name: 'Criar rascunho' }))

      await screen.findByText('A capacidade mínima é de 2 pessoas.')
      expect(screen.getByLabelText('Título')).toHaveValue('  Jantar às cegas ')
      expect(screen.getByLabelText('Início')).toHaveValue('2026-10-10T19:00')
    })

    it('replaces the form with "Área só para a equipe." on a 403', async () => {
      const { user } = renderNewEvent({ [CREATE]: byMethod({ POST: problemAnswer(403) }) })
      await fillValidForm(user)

      await user.click(screen.getByRole('button', { name: 'Criar rascunho' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Área só para a equipe.')
      expect(screen.queryByRole('form', { name: 'Novo evento' })).not.toBeInTheDocument()
    })

    it('offers to sign in again on a 401', async () => {
      const { user } = renderNewEvent({ [CREATE]: byMethod({ POST: problemAnswer(401) }) })
      await fillValidForm(user)

      await user.click(screen.getByRole('button', { name: 'Criar rascunho' }))

      expect(await screen.findByRole('link', { name: 'Entrar de novo' })).toBeInTheDocument()
      expect(screen.getByLabelText('Título')).toHaveValue('  Jantar às cegas ')
    })

    it.each([
      ['a server error', problemAnswer(500)],
      ['a network failure', networkFailure()],
    ])('warns that a retry may create a second draft after %s', async (_name, answer) => {
      const { user } = renderNewEvent({ [CREATE]: byMethod({ POST: answer }) })
      await fillValidForm(user)

      await user.click(screen.getByRole('button', { name: 'Criar rascunho' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('haverá dois rascunhos')
      expect(screen.getByRole('button', { name: 'Criar rascunho' })).toBeEnabled()
    })
  })
})
