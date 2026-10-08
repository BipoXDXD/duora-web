import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../app/App.tsx'
import { DINNER, pageOf, PICNIC, SESSION, WINE } from '../../test/eventFixtures.ts'
import {
  ANONYMOUS_SESSION,
  inSequence,
  networkFailure,
  neverAnswer,
  problemAnswer,
  stubApi,
  type FakeRoute,
} from '../../test/fakeApi.ts'
import { stubMatchMedia } from '../../test/fakeMatchMedia.ts'
import { elementsWithoutTouchTarget } from '../../test/touchTarget.ts'

const LIST = '/api/me/registrations'

/** Durante o jantar, antes do vinho. */
const DURING_DINNER = new Date('2026-10-10T23:00:00Z')

function mine(event: typeof DINNER | typeof WINE | typeof PICNIC, eventStatus = 'PUBLISHED') {
  return {
    eventId: event.id,
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    eventStatus,
    registeredAt: '2026-10-05T12:00:00Z',
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(DURING_DINNER)
})

afterEach(() => {
  vi.useRealTimers()
  window.history.replaceState(null, '', '/')
})

function renderPage(routes: Readonly<Record<string, FakeRoute>>, session = SESSION) {
  stubMatchMedia(false)
  window.history.replaceState(null, '', '/inscricoes')
  const fetchMock = stubApi({ ...session, ...routes })
  render(<App />)
  return { fetchMock, user: userEvent.setup() }
}

describe('my registrations page', () => {
  it('asks a visitor who is not logged in to sign in, without reading the list', async () => {
    const { fetchMock } = renderPage({ [LIST]: neverAnswer() }, ANONYMOUS_SESSION)

    expect(await screen.findByText('Entre para ver suas inscrições.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith(LIST, expect.anything())
  })

  it('shows that the list is loading', async () => {
    renderPage({ [LIST]: neverAnswer() })

    expect(await screen.findByText('Carregando suas inscrições…')).toBeInTheDocument()
  })

  it('offers to try again when the list could not be read', async () => {
    const { user } = renderPage({ [LIST]: inSequence(problemAnswer(500), pageOf([mine(WINE)])) })

    expect(await screen.findByText('Não foi possível carregar suas inscrições.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(await screen.findByRole('link', { name: 'Vinho e cartas' })).toBeInTheDocument()
  })

  it('invites to choose an event when there is no registration', async () => {
    renderPage({ [LIST]: pageOf([]) })

    expect(await screen.findByText('Você não tem inscrições em eventos futuros.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Escolher um evento' })).toHaveAttribute('href', '/eventos')
  })

  it('lists the registrations, marking the event in progress and the cancelled one', async () => {
    renderPage({ [LIST]: pageOf([mine(DINNER), mine(WINE, 'CANCELLED'), mine(PICNIC)]) })

    const items = within(await screen.findByRole('list', { name: 'Suas inscrições' })).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('Jantar às cegas')
    expect(items[0]).toHaveTextContent('Em andamento')
    expect(items[0]).toHaveTextContent('Inscrição feita em 5 de outubro de 2026')
    expect(items[1]).toHaveTextContent('Cancelado')
    expect(items[2]).not.toHaveTextContent(/Em andamento|Cancelado|Encerrado/)
    expect(within(items[0] ?? document.body).getByRole('link', { name: 'Jantar às cegas' })).toHaveAttribute(
      'href',
      `/eventos/${DINNER.id}`,
    )
  })

  it('loads the next page, and keeps the loaded ones when it fails', async () => {
    const { user } = renderPage({
      [LIST]: pageOf([mine(DINNER)], 'page-2'),
      [`${LIST}?pageToken=page-2`]: inSequence(networkFailure(), pageOf([mine(PICNIC)])),
    })

    await user.click(await screen.findByRole('button', { name: 'Carregar mais' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar mais. Tente de novo.')
    await user.click(screen.getByRole('button', { name: 'Carregar mais' }))

    expect(await screen.findByRole('link', { name: 'Piquenique no parque' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Jantar às cegas' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument()
  })

  it('gives every link and button a 44px touch target', async () => {
    renderPage({ [LIST]: pageOf([mine(DINNER)], 'page-2') })

    await screen.findByRole('button', { name: 'Carregar mais' })

    expect(elementsWithoutTouchTarget(screen.getByRole('main'))).toEqual([])
  })
})
