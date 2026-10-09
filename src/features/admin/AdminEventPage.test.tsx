import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ADMIN_CANCELLED,
  ADMIN_DRAFT,
  ADMIN_PUBLISHED,
  AFTER_DINNER,
  BEFORE_DINNER,
} from '../../test/adminFixtures.ts'
import { SESSION } from '../../test/eventFixtures.ts'
import {
  ANONYMOUS_SESSION,
  callsTo,
  type FakeRoute,
  inSequence,
  jsonAnswer,
  neverAnswer,
  problemAnswer,
  refusalAnswer,
} from '../../test/fakeApi.ts'
import { renderAppAt } from '../../test/renderApp.tsx'
import { elementsWithoutTouchTarget } from '../../test/touchTarget.ts'

const EVENT = `/api/admin/events/${ADMIN_DRAFT.id}`
const PUBLISH = `${EVENT}:publish`
const CANCEL = `${EVENT}:cancel`

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(BEFORE_DINNER)
})

afterEach(() => {
  vi.useRealTimers()
  window.history.replaceState(null, '', '/')
  document.cookie = 'XSRF-TOKEN=; path=/; max-age=0'
})

function renderAdminEvent(routes: Readonly<Record<string, FakeRoute>>, session = SESSION) {
  return renderAppAt(`/admin/eventos/${ADMIN_DRAFT.id}`, { ...session, ...routes })
}

function titleOf(name: string) {
  return screen.findByRole('heading', { level: 1, name })
}

describe('admin event page', () => {
  it('asks a visitor who is not logged in to sign in, without reading the event', async () => {
    const { fetchMock } = renderAdminEvent({ [EVENT]: neverAnswer() }, ANONYMOUS_SESSION)

    expect(await screen.findByText('Entre para ver este evento.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith(EVENT, expect.anything())
  })

  it('shows that the event is loading', async () => {
    renderAdminEvent({ [EVENT]: neverAnswer() })

    expect(await screen.findByText('Carregando o evento…')).toBeInTheDocument()
  })

  it('offers to try again when the event could not be read', async () => {
    const { user } = renderAdminEvent({ [EVENT]: inSequence(problemAnswer(500), jsonAnswer(ADMIN_DRAFT)) })

    expect(await screen.findByText('Não foi possível carregar o evento.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(await titleOf('Jantar às cegas')).toBeInTheDocument()
  })

  it('says "Área só para a equipe." on a 403, with nothing of the event', async () => {
    renderAdminEvent({ [EVENT]: problemAnswer(403) })

    expect(await titleOf('Área da equipe')).toHaveFocus()
    expect(screen.getByRole('alert')).toHaveTextContent('Área só para a equipe.')
    expect(screen.queryByRole('button', { name: /Publicar|Cancelar|Iniciar|Atualizar/ })).not.toBeInTheDocument()
  })

  it('says the event does not exist on a 404', async () => {
    renderAdminEvent({ [EVENT]: problemAnswer(404) })

    expect(await titleOf('Evento não encontrado')).toBeInTheDocument()
  })

  it('offers to sign in again on a 401', async () => {
    renderAdminEvent({ [EVENT]: problemAnswer(401) })

    expect(await screen.findByText('Sua sessão terminou. Entre de novo para continuar.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Entrar de novo' })).toBeInTheDocument()
  })

  describe('a draft', () => {
    it('shows the state, the time in the time zone of the user and the count of registrations', async () => {
      renderAdminEvent({ [EVENT]: jsonAnswer(ADMIN_DRAFT) })

      expect(await titleOf('Jantar às cegas')).toHaveFocus()
      expect(screen.getByText('Rascunho')).toBeInTheDocument()
      expect(screen.getByText(/sábado, 10 de outubro.*19:00.*22:00/)).toBeInTheDocument()
      expect(screen.getByText(/Uma noite de jogos de mesa\./)).toBeInTheDocument()
      expect(screen.getByText('0 pessoas inscritas de 40 vagas.')).toBeInTheDocument()
      expect(screen.getByText(/só a equipe o vê até ele ser publicado/)).toBeInTheDocument()
    })

    it('offers to publish and to cancel, and no link to the public page', async () => {
      renderAdminEvent({ [EVENT]: jsonAnswer(ADMIN_DRAFT) })

      expect(await screen.findByRole('button', { name: 'Publicar evento' })).toBeEnabled()
      expect(screen.getByRole('button', { name: 'Cancelar evento' })).toBeEnabled()
      expect(screen.queryByRole('link', { name: 'Ver como participante' })).not.toBeInTheDocument()
    })

    it('explains that rounds need a published event under way', async () => {
      renderAdminEvent({ [EVENT]: jsonAnswer(ADMIN_DRAFT) })

      expect(await screen.findByText('As rodadas só começam com o evento publicado e em andamento.')).toBeInTheDocument()
      expect(screen.queryByRole('form', { name: 'Iniciar rodada' })).not.toBeInTheDocument()
    })

    it('keeps every control with a touch target of 44px', async () => {
      renderAdminEvent({ [EVENT]: jsonAnswer(ADMIN_DRAFT) })
      await screen.findByRole('button', { name: 'Publicar evento' })

      expect(elementsWithoutTouchTarget(document.body)).toEqual([])
    })
  })

  describe('refreshing', () => {
    it('reads the event again and recounts the registrations', async () => {
      const { user } = renderAdminEvent({
        [EVENT]: inSequence(jsonAnswer(ADMIN_PUBLISHED), jsonAnswer({ ...ADMIN_PUBLISHED, registrationCount: 13 })),
      })
      expect(await screen.findByText('12 pessoas inscritas de 40 vagas.')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Atualizar' }))

      expect(await screen.findByText('13 pessoas inscritas de 40 vagas.')).toBeInTheDocument()
    })

    it('says "1 pessoa inscrita" for a single registration', async () => {
      renderAdminEvent({ [EVENT]: jsonAnswer({ ...ADMIN_PUBLISHED, registrationCount: 1 }) })

      expect(await screen.findByText('1 pessoa inscrita de 40 vagas.')).toBeInTheDocument()
    })
  })

  describe('publishing', () => {
    it('asks to confirm, with the focus on the confirmation, before sending anything', async () => {
      const { fetchMock, user } = renderAdminEvent({ [EVENT]: jsonAnswer(ADMIN_DRAFT) })

      await user.click(await screen.findByRole('button', { name: 'Publicar evento' }))

      expect(screen.getByText(/Publicar este evento\? Ele passa a aparecer/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Sim, publicar' })).toHaveFocus()
      expect(callsTo(fetchMock, PUBLISH, 'POST')).toHaveLength(0)
    })

    it('goes back to the button that opened the confirmation, without sending anything', async () => {
      const { fetchMock, user } = renderAdminEvent({ [EVENT]: jsonAnswer(ADMIN_DRAFT) })
      await user.click(await screen.findByRole('button', { name: 'Publicar evento' }))

      await user.click(screen.getByRole('button', { name: 'Voltar' }))

      expect(screen.getByRole('button', { name: 'Publicar evento' })).toHaveFocus()
      expect(screen.queryByRole('button', { name: 'Sim, publicar' })).not.toBeInTheDocument()
      expect(callsTo(fetchMock, PUBLISH, 'POST')).toHaveLength(0)
    })

    it('publishes with the CSRF token, says so, shows the new state and stops offering to publish', async () => {
      document.cookie = 'XSRF-TOKEN=csrf-123; path=/'
      const { fetchMock, user } = renderAdminEvent({
        [EVENT]: jsonAnswer(ADMIN_DRAFT),
        [PUBLISH]: jsonAnswer(ADMIN_PUBLISHED),
        '/api/events': jsonAnswer({ items: [], nextPageToken: null }),
      })
      await user.click(await screen.findByRole('button', { name: 'Publicar evento' }))

      await user.click(screen.getByRole('button', { name: 'Sim, publicar' }))

      const notice = await screen.findByRole('status')
      expect(notice).toHaveTextContent('Evento publicado.')
      expect(notice).toHaveFocus()
      expect(screen.getByText('Publicado')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Publicar evento' })).not.toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Ver como participante' })).toHaveAttribute(
        'href',
        `/eventos/${ADMIN_DRAFT.id}`,
      )
      expect(new Headers(callsTo(fetchMock, PUBLISH, 'POST')[0]?.[1]?.headers).get('X-XSRF-TOKEN')).toBe('csrf-123')
    })

    it('says it is publishing and blocks a second click meanwhile', async () => {
      const { fetchMock, user } = renderAdminEvent({
        [EVENT]: jsonAnswer(ADMIN_DRAFT),
        [PUBLISH]: neverAnswer(),
      })
      await user.click(await screen.findByRole('button', { name: 'Publicar evento' }))

      await user.click(screen.getByRole('button', { name: 'Sim, publicar' }))

      await waitFor(() => expect(screen.getByRole('button', { name: 'Publicando…' })).toBeDisabled())
      expect(callsTo(fetchMock, PUBLISH, 'POST')).toHaveLength(1)
    })

    it.each([
      ['EVENT_ALREADY_PUBLISHED', 'Este evento já estava publicado.'],
      ['EVENT_CANCELLED', 'Este evento foi cancelado, então não dá mais para publicá-lo.'],
      ['EVENT_STARTED', 'Este evento já começou, então não dá mais para publicá-lo.'],
      ['EVENT_ENDED', 'Este evento já terminou, então não dá mais para publicá-lo.'],
      ['FROM_THE_FUTURE', 'mudou ao mesmo tempo'],
    ])('explains a 409 with the reason %s and reads the event again', async (reason, text) => {
      const { fetchMock, user } = renderAdminEvent({
        [EVENT]: inSequence(jsonAnswer(ADMIN_DRAFT), jsonAnswer(ADMIN_PUBLISHED)),
        [PUBLISH]: refusalAnswer(409, reason),
      })
      await user.click(await screen.findByRole('button', { name: 'Publicar evento' }))

      await user.click(screen.getByRole('button', { name: 'Sim, publicar' }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(text)
      expect(alert).toHaveFocus()
      await waitFor(() => expect(callsTo(fetchMock, EVENT, 'GET')).toHaveLength(2))
      expect(await screen.findByText('Publicado')).toBeInTheDocument()
    })

    it('explains a 409 without a reason with the generic refusal', async () => {
      const { user } = renderAdminEvent({
        [EVENT]: jsonAnswer(ADMIN_DRAFT),
        [PUBLISH]: problemAnswer(409),
      })
      await user.click(await screen.findByRole('button', { name: 'Publicar evento' }))

      await user.click(screen.getByRole('button', { name: 'Sim, publicar' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('o evento não é um rascunho, já começou ou mudou')
    })

    it.each([
      [403, 'Área só para a equipe.'],
      [404, 'Este evento não existe mais.'],
      [500, 'Não foi possível publicar o evento. Tente de novo.'],
    ])('explains a %s', async (status, text) => {
      const { user } = renderAdminEvent({
        [EVENT]: jsonAnswer(ADMIN_DRAFT),
        [PUBLISH]: problemAnswer(status),
      })
      await user.click(await screen.findByRole('button', { name: 'Publicar evento' }))

      await user.click(screen.getByRole('button', { name: 'Sim, publicar' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(text)
    })

    it('offers to sign in again on a 401', async () => {
      const { user } = renderAdminEvent({ [EVENT]: jsonAnswer(ADMIN_DRAFT), [PUBLISH]: problemAnswer(401) })
      await user.click(await screen.findByRole('button', { name: 'Publicar evento' }))

      await user.click(screen.getByRole('button', { name: 'Sim, publicar' }))

      expect(await screen.findByRole('link', { name: 'Entrar de novo' })).toBeInTheDocument()
    })
  })

  describe('cancelling', () => {
    it('asks to confirm, warning that it cannot be undone, before sending anything', async () => {
      const { fetchMock, user } = renderAdminEvent({ [EVENT]: jsonAnswer(ADMIN_PUBLISHED) })

      await user.click(await screen.findByRole('button', { name: 'Cancelar evento' }))

      expect(screen.getByText(/isso não dá para desfazer/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Sim, cancelar o evento' })).toHaveFocus()
      expect(callsTo(fetchMock, CANCEL, 'POST')).toHaveLength(0)
    })

    it('goes back to the cancel button without sending anything', async () => {
      const { fetchMock, user } = renderAdminEvent({ [EVENT]: jsonAnswer(ADMIN_PUBLISHED) })
      await user.click(await screen.findByRole('button', { name: 'Cancelar evento' }))

      await user.click(screen.getByRole('button', { name: 'Voltar' }))

      expect(screen.getByRole('button', { name: 'Cancelar evento' })).toHaveFocus()
      expect(callsTo(fetchMock, CANCEL, 'POST')).toHaveLength(0)
    })

    it('cancels, says so and leaves nothing more to do', async () => {
      const { user } = renderAdminEvent({
        [EVENT]: jsonAnswer(ADMIN_PUBLISHED),
        [CANCEL]: jsonAnswer(ADMIN_CANCELLED),
        '/api/events': jsonAnswer({ items: [], nextPageToken: null }),
      })
      await user.click(await screen.findByRole('button', { name: 'Cancelar evento' }))

      await user.click(screen.getByRole('button', { name: 'Sim, cancelar o evento' }))

      const notice = await screen.findByRole('status')
      expect(notice).toHaveTextContent('Evento cancelado.')
      expect(screen.getByText('Cancelado')).toBeInTheDocument()
      expect(screen.getByText('Este evento foi cancelado.')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Cancelar evento' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Publicar evento' })).not.toBeInTheDocument()
    })

    it.each([
      ['EVENT_CANCELLED', 'Este evento já estava cancelado.'],
      ['EVENT_ENDED', 'Este evento já terminou, então não dá mais para cancelá-lo.'],
      ['FROM_THE_FUTURE', 'mudou ao mesmo tempo'],
    ])('explains a 409 with the reason %s', async (reason, text) => {
      const { user } = renderAdminEvent({
        [EVENT]: jsonAnswer(ADMIN_PUBLISHED),
        [CANCEL]: refusalAnswer(409, reason),
      })
      await user.click(await screen.findByRole('button', { name: 'Cancelar evento' }))

      await user.click(screen.getByRole('button', { name: 'Sim, cancelar o evento' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(text)
    })

    it('says "Área só para a equipe." on a 403', async () => {
      const { user } = renderAdminEvent({ [EVENT]: jsonAnswer(ADMIN_PUBLISHED), [CANCEL]: problemAnswer(403) })
      await user.click(await screen.findByRole('button', { name: 'Cancelar evento' }))

      await user.click(screen.getByRole('button', { name: 'Sim, cancelar o evento' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Área só para a equipe.')
    })

    it('does not offer to cancel an event that already ended', async () => {
      vi.setSystemTime(AFTER_DINNER)
      renderAdminEvent({ [EVENT]: jsonAnswer(ADMIN_PUBLISHED), '/api/events/0199b0c4-7f3a-7c2e-9a1b-2c3d4e5f6a7b': neverAnswer() })

      expect(await screen.findByText('Este evento já terminou.')).toBeInTheDocument()
      expect(screen.getByText('Encerrado')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Cancelar evento' })).not.toBeInTheDocument()
    })

    it('does not offer to cancel or publish a cancelled event', async () => {
      renderAdminEvent({ [EVENT]: jsonAnswer(ADMIN_CANCELLED) })

      expect(await screen.findByText('Este evento foi cancelado.')).toBeInTheDocument()
      expect(screen.getByText('Cancelado')).toBeInTheDocument()
      expect(within(screen.getByRole('region', { name: 'Publicação' })).queryByRole('button')).not.toBeInTheDocument()
      expect(screen.getByText('Este evento foi cancelado, então não há rodadas a iniciar.')).toBeInTheDocument()
    })
  })
})
