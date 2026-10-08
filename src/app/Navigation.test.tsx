import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { ANONYMOUS_SESSION, jsonAnswer, neverAnswer, stubApi, type FakeRoute } from '../test/fakeApi.ts'
import { stubMatchMedia } from '../test/fakeMatchMedia.ts'
import { App } from './App.tsx'

const SESSION = { '/api/me': jsonAnswer({ displayName: 'Ana Souza', profileComplete: true }) }
const PAGES = {
  '/api/me/profile': neverAnswer(),
  '/api/me/blocked-accounts': neverAnswer(),
  '/api/events': neverAnswer(),
  '/api/me/registrations': neverAnswer(),
  '/api/me/connections': neverAnswer(),
  '/api/events/0199b0c4-7f3a-7c2e-9a1b-2c3d4e5f6a7b': neverAnswer(),
}

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

  it('takes a logged in user to the connections and marks them as the current page', async () => {
    const { user, navigation } = renderAt('/')

    await user.click(await within(navigation).findByRole('link', { name: 'Conexões' }))

    expect(window.location.pathname).toBe('/conexoes')
    expect(screen.getByRole('heading', { level: 1, name: 'Conexões' })).toBeInTheDocument()
    expect(within(navigation).getByRole('link', { name: 'Conexões' })).toHaveAttribute('aria-current', 'page')
    expect(within(navigation).getByRole('link', { name: 'Eventos' })).not.toHaveAttribute('aria-current')
  })

  it('offers no connections link to a visitor who is not logged in', async () => {
    const { navigation } = renderAt('/', ANONYMOUS_SESSION)

    await screen.findAllByRole('link', { name: 'Entrar' })
    expect(within(navigation).queryByRole('link', { name: 'Conexões' })).not.toBeInTheDocument()
  })

  it('takes a logged in user to the events and marks them as the current page', async () => {
    const { user, navigation } = renderAt('/')

    await user.click(await within(navigation).findByRole('link', { name: 'Eventos' }))

    expect(window.location.pathname).toBe('/eventos')
    expect(screen.getByRole('heading', { level: 1, name: 'Eventos' })).toBeInTheDocument()
    expect(within(navigation).getByRole('link', { name: 'Eventos' })).toHaveAttribute('aria-current', 'page')
  })

  it('marks the events as the current page also on an event', async () => {
    const { navigation } = renderAt('/eventos/0199b0c4-7f3a-7c2e-9a1b-2c3d4e5f6a7b')

    expect(await within(navigation).findByRole('link', { name: 'Eventos' })).toHaveAttribute('aria-current', 'page')
  })

  it('offers no events link to a visitor who is not logged in', async () => {
    const { navigation } = renderAt('/', ANONYMOUS_SESSION)

    await screen.findAllByRole('link', { name: 'Entrar' })
    expect(within(navigation).queryByRole('link', { name: 'Eventos' })).not.toBeInTheDocument()
  })

  it('goes from the events to the own registrations', async () => {
    const { user } = renderAt('/eventos')

    await user.click(await within(screen.getByRole('main')).findByRole('link', { name: 'Minhas inscrições' }))

    expect(window.location.pathname).toBe('/inscricoes')
    expect(screen.getByRole('heading', { level: 1, name: 'Minhas inscrições' })).toBeInTheDocument()
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

describe.each([
  ['desktop', true, 'Principal'],
  ['mobile', false, 'Atalhos'],
])('link "Eventos" (%s)', (_layout, isDesktop, navigationName) => {
  it('is the current page also on the registrations, which are reached from the events', async () => {
    stubMatchMedia(isDesktop)
    window.history.replaceState(null, '', '/inscricoes')
    stubApi({ ...SESSION, ...PAGES })
    render(<App />)
    const navigation = screen.getByRole('navigation', { name: navigationName })

    expect(await within(navigation).findByRole('link', { name: 'Eventos' })).toHaveAttribute('aria-current', 'page')
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
