import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { ANONYMOUS_SESSION, jsonAnswer, neverAnswer, stubApi, type FakeRoute } from '../test/fakeApi.ts'
import { stubMatchMedia } from '../test/fakeMatchMedia.ts'
import { App } from './App.tsx'

const SESSION = { '/api/me': jsonAnswer({ displayName: 'Ana Souza', profileComplete: true }) }
const PAGES = { '/api/me/profile': neverAnswer(), '/api/me/blocked-accounts': neverAnswer() }

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe.each([
  ['desktop', true, 'Principal', 'Meu perfil'],
  ['mobile', false, 'Atalhos', 'Perfil'],
])('navigation (%s)', (_layout, isDesktop, navigationName, profileLinkName) => {
  function renderAt(path: string, session: Readonly<Record<string, FakeRoute>> = SESSION) {
    stubMatchMedia(isDesktop)
    window.history.replaceState(null, '', path)
    stubApi({ ...session, ...PAGES })
    render(<App />)
    return { user: userEvent.setup(), navigation: screen.getByRole('navigation', { name: navigationName }) }
  }

  it('takes a logged in user to the profile without reloading the page', async () => {
    const { user, navigation } = renderAt('/')

    await user.click(await within(navigation).findByRole('link', { name: profileLinkName }))

    expect(window.location.pathname).toBe('/perfil')
    expect(screen.getByRole('heading', { level: 1, name: 'Meu perfil' })).toBeInTheDocument()
    expect(within(navigation).getByRole('link', { name: profileLinkName })).toHaveAttribute('aria-current', 'page')
  })

  it('marks the profile as the current page also on the blocked accounts', async () => {
    const { navigation } = renderAt('/perfil/bloqueios')

    expect(await within(navigation).findByRole('link', { name: profileLinkName })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('offers no profile link to a visitor who is not logged in', async () => {
    const { navigation } = renderAt('/', ANONYMOUS_SESSION)

    await screen.findAllByRole('link', { name: 'Entrar' })
    expect(within(navigation).queryByRole('link', { name: profileLinkName })).not.toBeInTheDocument()
  })

  it('goes from the profile to the blocked accounts', async () => {
    const { user } = renderAt('/perfil')

    await user.click(await screen.findByRole('link', { name: 'Contas bloqueadas' }))

    expect(window.location.pathname).toBe('/perfil/bloqueios')
    expect(screen.getByRole('heading', { level: 1, name: 'Contas bloqueadas' })).toBeInTheDocument()
  })

  it('shows a not found page for an unknown address, with the way back home', async () => {
    const { user } = renderAt('/nao-existe')

    expect(screen.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Voltar ao início' }))

    expect(window.location.pathname).toBe('/')
    expect(screen.queryByRole('heading', { level: 1, name: 'Página não encontrada' })).not.toBeInTheDocument()
  })
})

describe('mobile tab "Início"', () => {
  it('is the current page only on the landing', async () => {
    stubMatchMedia(false)
    window.history.replaceState(null, '', '/perfil')
    stubApi({ ...SESSION, ...PAGES })
    render(<App />)
    const navigation = screen.getByRole('navigation', { name: 'Atalhos' })
    const home = within(navigation).getByRole('link', { name: 'Início' })
    expect(home).not.toHaveAttribute('aria-current')

    await userEvent.click(home)

    expect(home).toHaveAttribute('aria-current', 'page')
  })
})
