import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ADMIN_CANCELLED,
  ADMIN_DRAFT,
  ADMIN_PUBLISHED,
  AFTER_DINNER,
  BEFORE_DINNER,
  DURING_DINNER,
} from '../../test/adminFixtures.ts'
import { DINNER_TIME_TEXT, pageOf, SESSION } from '../../test/eventFixtures.ts'
import {
  ANONYMOUS_SESSION,
  inSequence,
  jsonAnswer,
  networkFailure,
  neverAnswer,
  problemAnswer,
  type FakeRoute,
} from '../../test/fakeApi.ts'
import { renderAppAt } from '../../test/renderApp.tsx'
import { elementsWithoutTouchTarget } from '../../test/touchTarget.ts'

const LIST = '/api/admin/events'

const WINE = {
  ...ADMIN_PUBLISHED,
  id: '0199a1d2-1111-7aaa-8bbb-cccccccccccc',
  title: 'Vinho e cartas',
  startsAt: '2026-10-17T22:00:00Z',
  endsAt: '2026-10-18T01:00:00Z',
  registrationCount: 1,
} as const

const PICNIC = {
  ...ADMIN_DRAFT,
  id: '01989f00-2222-7ddd-8eee-ffffffffffff',
  title: 'Piquenique no parque',
  startsAt: '2026-10-24T15:00:00Z',
  endsAt: '2026-10-24T18:00:00Z',
} as const

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(BEFORE_DINNER)
})

afterEach(() => {
  vi.useRealTimers()
  window.history.replaceState(null, '', '/')
})

function renderAdminEvents(routes: Readonly<Record<string, FakeRoute>>, session = SESSION) {
  return renderAppAt('/admin/eventos', { ...session, ...routes }, { isDesktop: true })
}

function eventItems() {
  return within(screen.getByRole('list', { name: 'Eventos' })).getAllByRole('listitem')
}

describe('admin events page', () => {
  it('asks a visitor who is not logged in to sign in, without reading the events', async () => {
    const { fetchMock } = renderAdminEvents({ [LIST]: neverAnswer() }, ANONYMOUS_SESSION)

    expect(await screen.findByText('Entre para ver os eventos da equipe.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith(LIST, expect.anything())
  })

  it('shows that the events are loading', async () => {
    renderAdminEvents({ [LIST]: neverAnswer() })

    expect(await screen.findByText('Carregando os eventos…')).toBeInTheDocument()
  })

  it('offers to try again when the events could not be read', async () => {
    const { user } = renderAdminEvents({ [LIST]: inSequence(problemAnswer(500), pageOf([ADMIN_DRAFT])) })

    expect(await screen.findByText('Não foi possível carregar os eventos.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(await screen.findByRole('link', { name: ADMIN_DRAFT.title })).toBeInTheDocument()
  })

  it('says "Área só para a equipe." on a 403, with no list, no filter and no way to create', async () => {
    renderAdminEvents({ [LIST]: problemAnswer(403) })

    expect(await screen.findByRole('alert')).toHaveTextContent('Área só para a equipe.')
    expect(screen.queryByRole('list', { name: 'Eventos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Novo evento' })).not.toBeInTheDocument()
  })

  it('offers to sign in again on a 401', async () => {
    renderAdminEvents({ [LIST]: problemAnswer(401) })

    expect(await screen.findByText('Sua sessão terminou. Entre de novo para continuar.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Entrar de novo' })).toBeInTheDocument()
  })

  it('says so when no event was created, and still offers to create one', async () => {
    renderAdminEvents({ [LIST]: pageOf([]) })

    expect(await screen.findByText('Nenhum evento criado ainda.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Eventos' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Novo evento' })).toBeInTheDocument()
  })

  it('lists the events in the order of the API, with the time in the time zone of the user and the count', async () => {
    renderAdminEvents({ [LIST]: pageOf([PICNIC, WINE, ADMIN_PUBLISHED]) })

    await screen.findByRole('list', { name: 'Eventos' })

    const items = eventItems()
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent(PICNIC.title)
    expect(items[0]).toHaveTextContent(/sábado, 24 de outubro.*12:00.*15:00/)
    expect(items[0]).toHaveTextContent('0 pessoas inscritas de 40 vagas.')
    expect(items[1]).toHaveTextContent(WINE.title)
    expect(items[1]).toHaveTextContent('1 pessoa inscrita de 40 vagas.')
    expect(items[2]).toHaveTextContent(ADMIN_DRAFT.title)
    expect(items[2]).toHaveTextContent(DINNER_TIME_TEXT)
    expect(items[2]).toHaveTextContent('12 pessoas inscritas de 40 vagas.')
  })

  it.each([
    ['a draft', ADMIN_DRAFT, BEFORE_DINNER, 'Rascunho'],
    ['a draft whose time has passed', ADMIN_DRAFT, AFTER_DINNER, 'Rascunho'],
    ['a published event that has not started', ADMIN_PUBLISHED, BEFORE_DINNER, 'Publicado'],
    ['a published event under way', ADMIN_PUBLISHED, DURING_DINNER, 'Em andamento'],
    ['a published event that is over', ADMIN_PUBLISHED, AFTER_DINNER, 'Encerrado'],
    ['a cancelled event', ADMIN_CANCELLED, BEFORE_DINNER, 'Cancelado'],
  ])('says in words that %s is "%s"', async (_case, event, now, label) => {
    vi.setSystemTime(now)
    renderAdminEvents({ [LIST]: pageOf([event]) })

    const [item] = await screen.findAllByRole('listitem')

    expect(item).toHaveTextContent(label)
  })

  it('links each event to its page for the staff', async () => {
    const { user } = renderAdminEvents({
      [LIST]: pageOf([ADMIN_DRAFT]),
      [`${LIST}/${ADMIN_DRAFT.id}`]: neverAnswer(),
    })

    await user.click(await screen.findByRole('link', { name: ADMIN_DRAFT.title }))

    expect(window.location.pathname).toBe(`/admin/eventos/${ADMIN_DRAFT.id}`)
  })

  it('goes to the new event form', async () => {
    const { user } = renderAdminEvents({ [LIST]: pageOf([]) })

    await user.click(await screen.findByRole('link', { name: 'Novo evento' }))

    expect(window.location.pathname).toBe('/admin/eventos/novo')
    expect(screen.getByRole('heading', { level: 1, name: 'Novo evento' })).toBeInTheDocument()
  })

  it('loads the next page on "Carregar mais" and stops offering it on the last page', async () => {
    const { user } = renderAdminEvents({
      [LIST]: pageOf([PICNIC, WINE], 'page-2'),
      [`${LIST}?pageToken=page-2`]: pageOf([ADMIN_PUBLISHED]),
    })

    await user.click(await screen.findByRole('button', { name: 'Carregar mais' }))

    expect(await screen.findByRole('link', { name: ADMIN_DRAFT.title })).toBeInTheDocument()
    expect(eventItems()).toHaveLength(3)
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument()
  })

  it('keeps the loaded events and offers to try again when the next page fails', async () => {
    const { user } = renderAdminEvents({
      [LIST]: pageOf([PICNIC], 'page-2'),
      [`${LIST}?pageToken=page-2`]: inSequence(networkFailure(), pageOf([WINE])),
    })

    await user.click(await screen.findByRole('button', { name: 'Carregar mais' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar mais. Tente de novo.')
    expect(screen.getByRole('link', { name: PICNIC.title })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Carregar mais' }))

    expect(await screen.findByRole('link', { name: WINE.title })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  describe('status filter', () => {
    it('offers every status, with "Todos" selected at first', async () => {
      renderAdminEvents({ [LIST]: pageOf([]) })

      const filter = await screen.findByRole('combobox', { name: 'Mostrar' })

      expect(within(filter).getAllByRole('option').map((option) => option.textContent)).toEqual([
        'Todos',
        'Rascunhos',
        'Publicados',
        'Cancelados',
      ])
      expect(filter).toHaveValue('')
    })

    it.each([
      ['Rascunhos', 'DRAFT'],
      ['Publicados', 'PUBLISHED'],
      ['Cancelados', 'CANCELLED'],
    ])('asks the API only for the %s', async (option, status) => {
      const { user, fetchMock } = renderAdminEvents({
        [LIST]: pageOf([PICNIC, ADMIN_PUBLISHED]),
        [`${LIST}?status=${status}`]: pageOf([PICNIC]),
      })

      await user.selectOptions(await screen.findByRole('combobox', { name: 'Mostrar' }), option)

      await screen.findByRole('list', { name: 'Eventos' })
      expect(fetchMock).toHaveBeenCalledWith(`${LIST}?status=${status}`, expect.anything())
      expect(eventItems()).toHaveLength(1)
      expect(screen.queryByRole('link', { name: ADMIN_DRAFT.title })).not.toBeInTheDocument()
    })

    it('keeps the filter and its focus while the filtered events load', async () => {
      const { user } = renderAdminEvents({
        [LIST]: pageOf([PICNIC]),
        [`${LIST}?status=CANCELLED`]: neverAnswer(),
      })
      const filter = await screen.findByRole('combobox', { name: 'Mostrar' })

      await user.selectOptions(filter, 'Cancelados')

      expect(await screen.findByText('Carregando os eventos…')).toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: 'Mostrar' })).toBe(filter)
      expect(filter).toHaveFocus()
      expect(filter).toHaveValue('CANCELLED')
    })

    it('says so when no event has the chosen status', async () => {
      const { user } = renderAdminEvents({
        [LIST]: pageOf([PICNIC]),
        [`${LIST}?status=CANCELLED`]: pageOf([]),
      })

      await user.selectOptions(await screen.findByRole('combobox', { name: 'Mostrar' }), 'Cancelados')

      expect(await screen.findByText('Nenhum evento neste estado.')).toBeInTheDocument()
      expect(screen.queryByText('Nenhum evento criado ainda.')).not.toBeInTheDocument()
    })

    it('keeps the status on the next page', async () => {
      const { user, fetchMock } = renderAdminEvents({
        [LIST]: pageOf([PICNIC]),
        [`${LIST}?status=DRAFT`]: pageOf([PICNIC], 'page-2'),
        [`${LIST}?status=DRAFT&pageToken=page-2`]: pageOf([ADMIN_DRAFT]),
      })
      await user.selectOptions(await screen.findByRole('combobox', { name: 'Mostrar' }), 'Rascunhos')

      await user.click(await screen.findByRole('button', { name: 'Carregar mais' }))

      expect(await screen.findByRole('link', { name: ADMIN_DRAFT.title })).toBeInTheDocument()
      expect(fetchMock).toHaveBeenCalledWith(`${LIST}?status=DRAFT&pageToken=page-2`, expect.anything())
    })

    it('goes back to every event on "Todos"', async () => {
      const { user } = renderAdminEvents({
        [LIST]: pageOf([PICNIC, ADMIN_PUBLISHED]),
        [`${LIST}?status=DRAFT`]: pageOf([PICNIC]),
      })
      const filter = await screen.findByRole('combobox', { name: 'Mostrar' })
      await user.selectOptions(filter, 'Rascunhos')
      await vi.waitFor(() => expect(eventItems()).toHaveLength(1))

      await user.selectOptions(filter, 'Todos')

      await vi.waitFor(() => expect(eventItems()).toHaveLength(2))
    })

    it('offers to try again, with the filter still there, when the filtered events fail', async () => {
      const { user } = renderAdminEvents({
        [LIST]: pageOf([PICNIC]),
        [`${LIST}?status=DRAFT`]: inSequence(problemAnswer(500), pageOf([PICNIC])),
      })
      await user.selectOptions(await screen.findByRole('combobox', { name: 'Mostrar' }), 'Rascunhos')

      expect(await screen.findByText('Não foi possível carregar os eventos.')).toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: 'Mostrar' })).toHaveValue('DRAFT')
      await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))

      expect(await screen.findByRole('link', { name: PICNIC.title })).toBeInTheDocument()
    })
  })

  it('shows the new status when the staff comes back from publishing an event', async () => {
    const { user } = renderAdminEvents({
      [LIST]: inSequence(pageOf([ADMIN_DRAFT]), pageOf([ADMIN_PUBLISHED])),
      [`${LIST}/${ADMIN_DRAFT.id}`]: jsonAnswer(ADMIN_DRAFT),
      [`${LIST}/${ADMIN_DRAFT.id}:publish`]: jsonAnswer(ADMIN_PUBLISHED),
    })
    await user.click(await screen.findByRole('link', { name: ADMIN_DRAFT.title }))
    await user.click(await screen.findByRole('button', { name: 'Publicar evento' }))
    await user.click(screen.getByRole('button', { name: 'Sim, publicar' }))
    await screen.findByText('12 pessoas inscritas de 40 vagas.')

    window.history.back()

    expect(await screen.findByRole('heading', { level: 1, name: 'Eventos da equipe' })).toBeInTheDocument()
    await vi.waitFor(() => expect(eventItems()[0]).toHaveTextContent('Publicado'))
    expect(eventItems()[0]).toHaveTextContent('12 pessoas inscritas de 40 vagas.')
  })

  it('gives every link, button and field a 44px touch target', async () => {
    renderAdminEvents({ [LIST]: pageOf([PICNIC], 'page-2') })

    await screen.findByRole('button', { name: 'Carregar mais' })

    expect(elementsWithoutTouchTarget(screen.getByRole('main'))).toEqual([])
  })
})
