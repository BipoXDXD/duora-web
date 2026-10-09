import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BEFORE_EVENTS, DINNER, pageOf, PICNIC, SESSION, WINE } from '../../test/eventFixtures.ts'
import {
  ANONYMOUS_SESSION,
  inSequence,
  networkFailure,
  neverAnswer,
  problemAnswer,
  type FakeRoute,
} from '../../test/fakeApi.ts'
import { renderAppAt } from '../../test/renderApp.tsx'
import { elementsWithoutTouchTarget } from '../../test/touchTarget.ts'

const LIST = '/api/events'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(BEFORE_EVENTS)
})

afterEach(() => {
  vi.useRealTimers()
  window.history.replaceState(null, '', '/')
})

function renderEventsPage(routes: Readonly<Record<string, FakeRoute>>, session = SESSION) {
  return renderAppAt('/eventos', { ...session, ...routes }, { isDesktop: true })
}

describe('events page', () => {
  it('asks a visitor who is not logged in to sign in, without reading the events', async () => {
    const { fetchMock } = renderEventsPage({ [LIST]: neverAnswer() }, ANONYMOUS_SESSION)

    expect(await screen.findByText('Entre para ver os próximos eventos.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith(LIST, expect.anything())
  })

  it('shows that the events are loading', async () => {
    renderEventsPage({ [LIST]: neverAnswer() })

    expect(await screen.findByText('Carregando os eventos…')).toBeInTheDocument()
  })

  it('offers to try again when the events could not be read', async () => {
    const { user } = renderEventsPage({ [LIST]: inSequence(problemAnswer(500), pageOf([DINNER])) })

    expect(await screen.findByText('Não foi possível carregar os eventos.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(await screen.findByRole('link', { name: 'Jantar às cegas' })).toBeInTheDocument()
  })

  it('says so when no event is scheduled', async () => {
    renderEventsPage({ [LIST]: pageOf([]) })

    expect(await screen.findByText('Nenhum evento marcado por enquanto.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Próximos eventos' })).not.toBeInTheDocument()
  })

  it('lists the events in the order of the API, with the time in the time zone of the user', async () => {
    renderEventsPage({ [LIST]: pageOf([DINNER, WINE]) })

    const items = within(await screen.findByRole('list', { name: 'Próximos eventos' })).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Jantar às cegas')
    expect(items[0]).toHaveTextContent(/sábado, 10 de outubro.*19:00.*22:00/)
    expect(items[0]).toHaveTextContent('Uma noite de jogos de mesa.')
    expect(items[1]).toHaveTextContent('Vinho e cartas')
  })

  it('links each event to its page', async () => {
    const { user } = renderEventsPage({ [LIST]: pageOf([DINNER]), [`${LIST}/${DINNER.id}`]: neverAnswer() })

    await user.click(await screen.findByRole('link', { name: 'Jantar às cegas' }))

    expect(window.location.pathname).toBe(`/eventos/${DINNER.id}`)
  })

  it('loads the next page on "Carregar mais" and stops offering it on the last page', async () => {
    const { user } = renderEventsPage({
      [LIST]: pageOf([DINNER, WINE], 'page-2'),
      [`${LIST}?pageToken=page-2`]: pageOf([PICNIC]),
    })

    await user.click(await screen.findByRole('button', { name: 'Carregar mais' }))

    expect(await screen.findByRole('link', { name: 'Piquenique no parque' })).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Próximos eventos' })).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument()
  })

  it('keeps the loaded events and offers to try again when the next page fails', async () => {
    const { user } = renderEventsPage({
      [LIST]: pageOf([DINNER], 'page-2'),
      [`${LIST}?pageToken=page-2`]: inSequence(networkFailure(), pageOf([PICNIC])),
    })

    await user.click(await screen.findByRole('button', { name: 'Carregar mais' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar mais. Tente de novo.')
    expect(screen.getByRole('link', { name: 'Jantar às cegas' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Carregar mais' }))

    expect(await screen.findByRole('link', { name: 'Piquenique no parque' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('says it is loading the next page and blocks a second click meanwhile', async () => {
    const { user } = renderEventsPage({
      [LIST]: pageOf([DINNER], 'page-2'),
      [`${LIST}?pageToken=page-2`]: neverAnswer(),
    })

    await user.click(await screen.findByRole('button', { name: 'Carregar mais' }))

    expect(await screen.findByRole('button', { name: 'Carregando…' })).toBeDisabled()
  })

  it('links to the own registrations', async () => {
    renderEventsPage({ [LIST]: pageOf([]) })

    expect(await screen.findByRole('link', { name: 'Minhas inscrições' })).toHaveAttribute('href', '/inscricoes')
  })

  it('gives every link and button a 44px touch target', async () => {
    renderEventsPage({ [LIST]: pageOf([DINNER], 'page-2') })

    await screen.findByRole('button', { name: 'Carregar mais' })

    expect(elementsWithoutTouchTarget(screen.getByRole('main'))).toEqual([])
  })
})
