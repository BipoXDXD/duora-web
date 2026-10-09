import { focusManager } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Component, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../app/App.tsx'
import { navigateTo } from '../../shared/browser/navigateTo.ts'
import {
  ANONYMOUS_SESSION,
  jsonAnswer,
  networkFailure,
  neverAnswer,
  statusAnswer,
  stubApi,
  type FakeRoute,
} from '../../test/fakeApi.ts'
import { stubMatchMedia } from '../../test/fakeMatchMedia.ts'
import { elementsWithoutTouchTarget } from '../../test/touchTarget.ts'

vi.mock('../../shared/browser/navigateTo.ts', () => ({ navigateTo: vi.fn<(url: string) => void>() }))

const ANA = jsonAnswer({ displayName: 'Ana Souza', roles: [] })
const ENTRA_LOGOUT = 'https://duoraapp.ciamlogin.com/tenant/oauth2/v2.0/logout?client_id=web'
const LOGOUT_FAILED = 'Não foi possível sair. Tente de novo.'
const SESSION_UNAVAILABLE = 'Não foi possível verificar sua sessão.'

beforeEach(() => {
  vi.mocked(navigateTo).mockClear()
})

afterEach(() => {
  document.cookie = 'XSRF-TOKEN=; path=/; max-age=0'
  focusManager.setFocused(undefined)
})

/** Um bug que escapa do app derruba a árvore até aqui, como derrubaria a página inteira. */
class CrashBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  override state = { crashed: false }

  static getDerivedStateFromError() {
    return { crashed: true }
  }

  override render() {
    return this.state.crashed ? <p>o app caiu</p> : this.props.children
  }
}

/** O nome aparece sozinho na tela; o leitor de tela ouve a frase inteira. */
async function findGreeting(name: string): Promise<HTMLElement> {
  const greeting = await screen.findByText(name)
  expect(greeting).toHaveTextContent(`Você entrou como ${name}`)
  return greeting
}

function silenceReactErrorLog() {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
}

describe.each([
  ['desktop', true],
  ['mobile', false],
])('session controls (%s)', (_layout, isDesktop) => {
  function renderApp(routes: Readonly<Record<string, FakeRoute>>) {
    stubMatchMedia(isDesktop)
    const fetchMock = stubApi(routes)
    const view = render(<App />)
    return { fetchMock, ...view }
  }

  it('shows neither "Entrar" nor "Sair" while the session is being checked', () => {
    renderApp({ '/api/me': neverAnswer() })

    expect(screen.getByText('Verificando sua sessão…')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument()
  })

  it('offers "Entrar" to an anonymous visitor', async () => {
    renderApp(ANONYMOUS_SESSION)

    expect(await screen.findByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/oauth2/authorization/entra')
    expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument()
    expect(screen.queryByText('Verificando sua sessão…')).not.toBeInTheDocument()
  })

  it('shows who is logged in and offers "Sair" instead of "Entrar"', async () => {
    renderApp({ '/api/me': ANA })

    await findGreeting('Ana Souza')
    expect(screen.getByRole('button', { name: 'Sair' })).toBeEnabled()
    expect(screen.queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument()
  })

  it('says the visitor is logged in when the user has no name', async () => {
    renderApp({ '/api/me': jsonAnswer({ displayName: null, roles: [] }) })

    expect(await screen.findByText('Você entrou')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
  })

  it.each([
    ['the API fails', statusAnswer(500)],
    ['the network is down', networkFailure()],
    ['the answer is out of the contract', jsonAnswer({ name: 'Ana' })],
  ])('says the session could not be checked when %s', async (_case, answer) => {
    renderApp({ '/api/me': answer })

    expect(await screen.findByText(SESSION_UNAVAILABLE)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument()
  })

  it('checks the session again on "Tentar de novo"', async () => {
    let answer = networkFailure()
    renderApp({ '/api/me': () => answer() })
    const user = userEvent.setup()
    const retry = await screen.findByRole('button', { name: 'Tentar de novo' })

    answer = statusAnswer(401)
    await user.click(retry)

    expect(await screen.findByRole('link', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.queryByText(SESSION_UNAVAILABLE)).not.toBeInTheDocument()
  })

  it('keeps showing the user when checking the session again fails', async () => {
    let answer = ANA
    const { fetchMock } = renderApp({ '/api/me': () => answer() })
    await findGreeting('Ana Souza')

    answer = networkFailure()
    act(() => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Ana Souza')).toBeInTheDocument()
    expect(screen.queryByText(SESSION_UNAVAILABLE)).not.toBeInTheDocument()
  })

  it('logs out with the CSRF token and goes to the Entra logout URL', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-123; path=/'
    const { fetchMock } = renderApp({ '/api/me': ANA, '/logout': jsonAnswer({ logoutUrl: ENTRA_LOGOUT }) })
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Sair' }))

    await waitFor(() => expect(navigateTo).toHaveBeenCalledExactlyOnceWith(ENTRA_LOGOUT))
    const logoutCall = fetchMock.mock.calls.find(([path]) => path === '/logout')
    expect(logoutCall?.[1]?.method).toBe('POST')
    expect(new Headers(logoutCall?.[1]?.headers).get('X-XSRF-TOKEN')).toBe('csrf-123')
  })

  it('disables "Sair" while logging out, so a second click does not post again', async () => {
    renderApp({ '/api/me': ANA, '/logout': neverAnswer() })
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Sair' }))

    expect(await screen.findByRole('button', { name: 'Saindo…' })).toBeDisabled()
  })

  it('stays on "Saindo…" while the browser goes to the Entra logout', async () => {
    renderApp({ '/api/me': ANA, '/logout': jsonAnswer({ logoutUrl: ENTRA_LOGOUT }) })
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Sair' }))

    await waitFor(() => expect(navigateTo).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: 'Saindo…' })).toBeDisabled()
  })

  it.each([
    ['the API refuses it', statusAnswer(403)],
    ['the network is down', networkFailure()],
    ['the logout URL is not HTTPS', jsonAnswer({ logoutUrl: 'javascript:alert(1)' })],
  ])('alerts that the logout failed when %s, and lets the user try again', async (_case, answer) => {
    renderApp({ '/api/me': ANA, '/logout': answer })
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Sair' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(LOGOUT_FAILED)
    expect(screen.getByRole('button', { name: 'Sair' })).toBeEnabled()
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('clears the logout alert when the user tries again', async () => {
    let answer = networkFailure()
    renderApp({ '/api/me': ANA, '/logout': () => answer() })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Sair' }))
    await screen.findByRole('alert')

    answer = neverAnswer()
    await user.click(screen.getByRole('button', { name: 'Sair' }))

    expect(await screen.findByRole('button', { name: 'Saindo…' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each([
    ['anonymous', ANONYMOUS_SESSION, 'Entrar'],
    ['logged in', { '/api/me': ANA }, 'Sair'],
    ['unavailable', { '/api/me': statusAnswer(503) }, 'Tentar de novo'],
  ])('gives every control a 44×44px touch target when the session is %s', async (_state, routes, control) => {
    const { container } = renderApp(routes)

    await screen.findByText(control)

    expect(elementsWithoutTouchTarget(container)).toEqual([])
  })

  it('does not hide a bug in the session check as an unavailable session', async () => {
    silenceReactErrorLog()
    stubMatchMedia(isDesktop)
    stubApi({ '/api/me': () => Promise.reject(new RangeError('bug')) })

    render(
      <CrashBoundary>
        <App />
      </CrashBoundary>,
    )

    expect(await screen.findByText('o app caiu')).toBeInTheDocument()
  })

  it('does not hide a TypeError from our own code as a network failure', async () => {
    silenceReactErrorLog()
    stubMatchMedia(isDesktop)
    const response = new Response(null, { status: 500 })
    Object.defineProperty(response, 'headers', { value: undefined })
    stubApi({ '/api/me': () => Promise.resolve(response) })

    render(
      <CrashBoundary>
        <App />
      </CrashBoundary>,
    )

    expect(await screen.findByText('o app caiu')).toBeInTheDocument()
  })

  it('does not hide a bug in the logout as a failed logout', async () => {
    silenceReactErrorLog()
    stubMatchMedia(isDesktop)
    stubApi({ '/api/me': ANA, '/logout': () => Promise.reject(new RangeError('bug')) })
    render(
      <CrashBoundary>
        <App />
      </CrashBoundary>,
    )
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Sair' }))

    expect(await screen.findByText('o app caiu')).toBeInTheDocument()
  })
})

describe('session controls placement', () => {
  it('puts "Sair" in the bottom bar on mobile, within thumb reach', async () => {
    stubMatchMedia(false)
    stubApi({ '/api/me': ANA })

    render(<App />)

    const shortcuts = screen.getByRole('navigation', { name: 'Atalhos' })
    expect(await within(shortcuts).findByRole('button', { name: 'Sair' })).toBeInTheDocument()
  })

  it('puts "Sair" in the header on desktop', async () => {
    stubMatchMedia(true)
    stubApi({ '/api/me': ANA })

    render(<App />)

    expect(await within(screen.getByRole('banner')).findByRole('button', { name: 'Sair' })).toBeInTheDocument()
  })
})
