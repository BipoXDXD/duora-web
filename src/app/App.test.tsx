import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { stubMatchMedia } from '../test/fakeMatchMedia.ts'
import { App } from './App.tsx'

describe('App', () => {
  it('shows the desktop layout on a wide screen', () => {
    stubMatchMedia(true)

    render(<App />)

    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Atalhos' })).not.toBeInTheDocument()
  })

  it('shows the mobile layout on a narrow screen', () => {
    stubMatchMedia(false)

    render(<App />)

    expect(screen.getByRole('navigation', { name: 'Atalhos' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Principal' })).not.toBeInTheDocument()
  })

  it('switches layout when the screen width crosses the breakpoint', () => {
    const media = stubMatchMedia(false)
    render(<App />)

    act(() => {
      media.setMatches(true)
    })

    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Atalhos' })).not.toBeInTheDocument()
  })

  it.each([true, false])('links "Entrar" to the BFF login (desktop: %s)', (isDesktop) => {
    stubMatchMedia(isDesktop)

    render(<App />)

    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/oauth2/authorization/entra')
  })
})
