import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../../app/App.tsx'
import { pageOf, SESSION } from '../../test/eventFixtures.ts'
import {
  ANONYMOUS_SESSION,
  inSequence,
  networkFailure,
  neverAnswer,
  problemAnswer,
  statusAnswer,
  stubApi,
  type FakeRoute,
} from '../../test/fakeApi.ts'
import { stubMatchMedia } from '../../test/fakeMatchMedia.ts'
import { elementsWithoutTouchTarget } from '../../test/touchTarget.ts'

const LIST = '/api/me/blocked-accounts'

const BEA = { accountId: '0199b0c4-7f3a-7c2e-9a1b-2c3d4e5f6a7b', blockedAt: '2026-10-03T12:00:00Z' }
const CAIO = { accountId: '0199a1d2-1111-7aaa-8bbb-cccccccccccc', blockedAt: '2026-09-20T12:00:00Z' }
const DANI = { accountId: '01989f00-2222-7ddd-8eee-ffffffffffff', blockedAt: '2026-08-15T12:00:00Z' }

afterEach(() => {
  window.history.replaceState(null, '', '/')
  document.cookie = 'XSRF-TOKEN=; path=/; max-age=0'
})

function renderBlockedPage(routes: Readonly<Record<string, FakeRoute>>, session = SESSION) {
  stubMatchMedia(false)
  window.history.replaceState(null, '', '/perfil/bloqueios')
  const fetchMock = stubApi({ ...session, ...routes })
  render(<App />)
  return { fetchMock, user: userEvent.setup() }
}

function unblockPath(accountId: string): string {
  return `/api/accounts/${accountId}:unblock`
}

async function findItem(date: string): Promise<HTMLElement> {
  const items = await screen.findAllByRole('listitem')
  const item = items.find((candidate) => within(candidate).queryByText(`Bloqueada em ${date}`) !== null)
  if (item === undefined) {
    throw new Error(`nenhum item bloqueado em ${date}`)
  }
  return item
}

describe('blocked accounts page', () => {
  it('asks a visitor who is not logged in to sign in, without reading the list', async () => {
    const { fetchMock } = renderBlockedPage({ [LIST]: neverAnswer() }, ANONYMOUS_SESSION)

    expect(await screen.findByText('Entre para ver as contas que você bloqueou.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith(LIST, expect.anything())
  })

  it('shows that the list is loading', async () => {
    renderBlockedPage({ [LIST]: neverAnswer() })

    expect(await screen.findByText('Carregando as contas bloqueadas…')).toBeInTheDocument()
  })

  it('offers to try again when the list could not be read', async () => {
    const { user } = renderBlockedPage({ [LIST]: inSequence(problemAnswer(500), pageOf([BEA])) })

    expect(await screen.findByText('Não foi possível carregar as contas bloqueadas.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(await findItem('3 de outubro de 2026')).toBeInTheDocument()
  })

  it('says so when nobody is blocked', async () => {
    renderBlockedPage({ [LIST]: pageOf([]) })

    expect(await screen.findByText('Você não bloqueou ninguém.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Contas bloqueadas' })).not.toBeInTheDocument()
  })

  it('lists the blocks, the most recent first, with the date and the end of the id of each account', async () => {
    renderBlockedPage({ [LIST]: pageOf([BEA, CAIO]) })

    const list = await screen.findByRole('list', { name: 'Contas bloqueadas' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Conta 4e5f6a7b')
    expect(items[0]).toHaveTextContent('Bloqueada em 3 de outubro de 2026')
    expect(items[1]).toHaveTextContent('Bloqueada em 20 de setembro de 2026')
  })

  it('loads the next page on "Carregar mais" and stops offering it on the last page', async () => {
    const { user } = renderBlockedPage({
      [LIST]: pageOf([BEA, CAIO], 'page-2'),
      [`${LIST}?pageToken=page-2`]: pageOf([DANI]),
    })

    await user.click(await screen.findByRole('button', { name: 'Carregar mais' }))

    expect(await findItem('15 de agosto de 2026')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Contas bloqueadas' })).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument()
  })

  it('keeps the loaded blocks and offers to try again when the next page fails', async () => {
    const { user } = renderBlockedPage({
      [LIST]: pageOf([BEA], 'page-2'),
      [`${LIST}?pageToken=page-2`]: inSequence(networkFailure(), pageOf([DANI])),
    })

    await user.click(await screen.findByRole('button', { name: 'Carregar mais' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar mais. Tente de novo.')
    expect(screen.getByText('Bloqueada em 3 de outubro de 2026')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Carregar mais' }))

    expect(await findItem('15 de agosto de 2026')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('asks for confirmation before unblocking, and "Cancelar" changes nothing', async () => {
    const { fetchMock, user } = renderBlockedPage({ [LIST]: pageOf([BEA]) })
    const item = await findItem('3 de outubro de 2026')

    await user.click(within(item).getByRole('button', { name: 'Desbloquear' }))

    expect(within(item).getByText(/Desbloquear esta conta\?/)).toBeInTheDocument()
    expect(within(item).getByRole('button', { name: 'Sim, desbloquear' })).toHaveFocus()

    await user.click(within(item).getByRole('button', { name: 'Cancelar' }))

    expect(within(item).getByRole('button', { name: 'Desbloquear' })).toHaveFocus()
    expect(fetchMock).not.toHaveBeenCalledWith(unblockPath(BEA.accountId), expect.anything())
  })

  it('unblocks on confirmation, with the CSRF token, and takes the account off the list', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-123; path=/'
    const { fetchMock, user } = renderBlockedPage({ [LIST]: pageOf([BEA, CAIO]), [unblockPath(BEA.accountId)]: statusAnswer(204) })
    const item = await findItem('3 de outubro de 2026')

    await user.click(within(item).getByRole('button', { name: 'Desbloquear' }))
    await user.click(within(item).getByRole('button', { name: 'Sim, desbloquear' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Conta desbloqueada.')
    expect(screen.queryByText('Bloqueada em 3 de outubro de 2026')).not.toBeInTheDocument()
    expect(screen.getByText('Bloqueada em 20 de setembro de 2026')).toBeInTheDocument()
    const call = fetchMock.mock.calls.find(([path]) => path === unblockPath(BEA.accountId))
    expect(call?.[1]?.method).toBe('POST')
    expect(new Headers(call?.[1]?.headers).get('X-XSRF-TOKEN')).toBe('csrf-123')
  })

  it('shows the empty state after unblocking the last account', async () => {
    const { user } = renderBlockedPage({ [LIST]: pageOf([BEA]), [unblockPath(BEA.accountId)]: statusAnswer(204) })
    const item = await findItem('3 de outubro de 2026')

    await user.click(within(item).getByRole('button', { name: 'Desbloquear' }))
    await user.click(within(item).getByRole('button', { name: 'Sim, desbloquear' }))

    expect(await screen.findByText('Você não bloqueou ninguém.')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Conta desbloqueada.')
  })

  it('keeps the account blocked and says so when the unblock fails', async () => {
    const { user } = renderBlockedPage({ [LIST]: pageOf([BEA]), [unblockPath(BEA.accountId)]: problemAnswer(500) })
    const item = await findItem('3 de outubro de 2026')

    await user.click(within(item).getByRole('button', { name: 'Desbloquear' }))
    await user.click(within(item).getByRole('button', { name: 'Sim, desbloquear' }))

    expect(await within(item).findByRole('alert')).toHaveTextContent('Não foi possível desbloquear. Tente de novo.')
    expect(within(item).getByRole('button', { name: 'Desbloquear' })).toBeEnabled()
  })

  it('says it is unblocking and blocks a second click meanwhile', async () => {
    const { user } = renderBlockedPage({ [LIST]: pageOf([BEA]), [unblockPath(BEA.accountId)]: neverAnswer() })
    const item = await findItem('3 de outubro de 2026')

    await user.click(within(item).getByRole('button', { name: 'Desbloquear' }))
    await user.click(within(item).getByRole('button', { name: 'Sim, desbloquear' }))

    await waitFor(() => expect(within(item).getByRole('button', { name: 'Desbloqueando…' })).toBeDisabled())
  })

  it('links back to the profile', async () => {
    renderBlockedPage({ [LIST]: pageOf([]) })

    expect(await screen.findByRole('link', { name: 'Voltar ao perfil' })).toHaveAttribute('href', '/perfil')
  })

  it('gives every link and button a 44px touch target', async () => {
    const { user } = renderBlockedPage({ [LIST]: pageOf([BEA], 'page-2') })
    const item = await findItem('3 de outubro de 2026')
    expect(elementsWithoutTouchTarget(screen.getByRole('main'))).toEqual([])

    await user.click(within(item).getByRole('button', { name: 'Desbloquear' }))

    expect(elementsWithoutTouchTarget(screen.getByRole('main'))).toEqual([])
  })
})
