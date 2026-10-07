import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { ANONYMOUS_SESSION, stubApi } from '../test/fakeApi.ts'
import { stubMatchMedia } from '../test/fakeMatchMedia.ts'
import { App } from './App.tsx'

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe.each([
  ['desktop', true],
  ['mobile', false],
])('navigation (%s)', (_layout, isDesktop) => {
  it('shows a not found page for an unknown address, with the way back home', async () => {
    stubMatchMedia(isDesktop)
    window.history.replaceState(null, '', '/nao-existe')
    stubApi(ANONYMOUS_SESSION)
    render(<App />)
    const user = userEvent.setup()

    expect(screen.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Voltar ao início' }))

    expect(window.location.pathname).toBe('/')
    expect(screen.queryByRole('heading', { level: 1, name: 'Página não encontrada' })).not.toBeInTheDocument()
  })
})

describe('mobile tab "Início"', () => {
  it('is the current page only on the landing', async () => {
    stubMatchMedia(false)
    window.history.replaceState(null, '', '/nao-existe')
    stubApi(ANONYMOUS_SESSION)
    render(<App />)
    const home = within(screen.getByRole('navigation', { name: 'Atalhos' })).getByRole('link', { name: 'Início' })
    expect(home).not.toHaveAttribute('aria-current')

    await userEvent.click(home)

    expect(home).toHaveAttribute('aria-current', 'page')
  })
})
