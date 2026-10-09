import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../../app/App.tsx'
import { pageOf, SESSION } from '../../test/eventFixtures.ts'
import {
  ANONYMOUS_SESSION,
  inSequence,
  neverAnswer,
  problemAnswer,
  stubApi,
  type FakeRoute,
} from '../../test/fakeApi.ts'
import { stubMatchMedia } from '../../test/fakeMatchMedia.ts'
import { elementsWithoutTouchTarget } from '../../test/touchTarget.ts'

const LIST = '/api/me/connections'

const BEA = { accountId: '0199b0c4-7f3a-7c2e-9a1b-2c3d4e5f6a7b', connectedAt: '2026-10-03T12:00:00Z' }
const CAIO = { accountId: '0199a1d2-1111-7aaa-8bbb-cccccccccccc', connectedAt: '2026-09-20T12:00:00Z' }

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

function renderConnectionsPage(routes: Readonly<Record<string, FakeRoute>>, session = SESSION) {
  stubMatchMedia(false)
  window.history.replaceState(null, '', '/conexoes')
  const fetchMock = stubApi({ ...session, ...routes })
  render(<App />)
  return { fetchMock, user: userEvent.setup() }
}

describe('connections page', () => {
  it('asks a visitor who is not logged in to sign in, without reading the list', async () => {
    const { fetchMock } = renderConnectionsPage({ [LIST]: neverAnswer() }, ANONYMOUS_SESSION)

    expect(await screen.findByText('Entre para ver suas conexões.')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([path]) => String(path).startsWith(LIST))).toBe(false)
  })

  it('focuses the title when it opens', async () => {
    renderConnectionsPage({ [LIST]: neverAnswer() })

    expect(await screen.findByRole('heading', { level: 1, name: 'Conexões' })).toHaveFocus()
  })

  it('shows that the list is loading', async () => {
    renderConnectionsPage({ [LIST]: neverAnswer() })

    expect(await screen.findByText('Carregando suas conexões…')).toHaveAttribute('role', 'status')
  })

  it('offers to try again when the list could not be read', async () => {
    const { user } = renderConnectionsPage({ [LIST]: inSequence(problemAnswer(500), pageOf([BEA])) })

    expect(await screen.findByText('Não foi possível carregar suas conexões.')).toHaveAttribute('role', 'alert')
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(await screen.findByText('Conta 4e5f6a7b')).toBeInTheDocument()
  })

  it('explains how a connection comes up when there is none yet', async () => {
    renderConnectionsPage({ [LIST]: pageOf([]) })

    expect(await screen.findByText('Você ainda não tem conexões.')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Depois de cada rodada de um evento, você decide em privado se quer continuar em contato com sua dupla. Quando as duas pessoas querem, vocês viram uma conexão, e ela aparece aqui.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver os eventos' })).toHaveAttribute('href', '/eventos')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('lists each connection by the end of the account id and the date, newest first', async () => {
    renderConnectionsPage({ [LIST]: pageOf([BEA, CAIO]) })

    const list = await screen.findByRole('list', { name: 'Suas conexões' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Conta 4e5f6a7bConectados em 3 de outubro de 2026')
    expect(items[1]).toHaveTextContent('Conta ccccccccConectados em 20 de setembro de 2026')
  })

  it('loads more pages with the token until the last one', async () => {
    const { fetchMock, user } = renderConnectionsPage({
      [LIST]: pageOf([BEA], 'next-1'),
      [`${LIST}?pageToken=next-1`]: pageOf([CAIO]),
    })
    await screen.findByText('Conta 4e5f6a7b')

    await user.click(screen.getByRole('button', { name: 'Carregar mais' }))

    expect(await screen.findByText('Conta cccccccc')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(([path]) => String(path).startsWith(LIST))).toHaveLength(2)
  })

  it('keeps the list and asks to try again when the next page fails', async () => {
    const { user } = renderConnectionsPage({
      [LIST]: pageOf([BEA], 'next-1'),
      [`${LIST}?pageToken=next-1`]: problemAnswer(503),
    })
    await screen.findByText('Conta 4e5f6a7b')

    await user.click(screen.getByRole('button', { name: 'Carregar mais' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar mais. Tente de novo.')
    expect(screen.getByText('Conta 4e5f6a7b')).toBeInTheDocument()
  })

  it('asks to sign in again when the session ended', async () => {
    renderConnectionsPage({ [LIST]: problemAnswer(401) })

    expect(await screen.findByText('Sua sessão terminou. Entre de novo para ver suas conexões.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Entrar de novo' })).toHaveAttribute('href', '/oauth2/authorization/entra')
  })

  it('gives every link and button a 44px touch target', async () => {
    renderConnectionsPage({ [LIST]: pageOf([BEA], 'next-1') })
    await screen.findByText('Conta 4e5f6a7b')

    expect(elementsWithoutTouchTarget(screen.getByRole('main'))).toEqual([])
  })
})
