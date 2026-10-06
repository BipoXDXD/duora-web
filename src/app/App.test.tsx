import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { stubMatchMedia } from '../test/fakeMatchMedia.ts'
import { App } from './App.tsx'

/** `min-h-12` (48px) também vale: é o campo e o botão maiores do hero. */
function hasTouchTargetSize(element: Element): boolean {
  const isTallEnough = element.classList.contains('min-h-11') || element.classList.contains('min-h-12')
  return isTallEnough && element.classList.contains('min-w-11')
}

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

  it.each([true, false])('offers the waitlist sign-up (desktop: %s)', (isDesktop) => {
    stubMatchMedia(isDesktop)

    render(<App />)

    expect(screen.getByRole('button', { name: 'Entrar na lista' })).toBeInTheDocument()
  })

  /** 44×44px (`min-h-11 min-w-11`), o alvo de toque da WCAG 2.5.5. O jsdom não faz layout, então o teste lê as classes. */
  it.each([true, false])('gives every link, button and field a 44×44px touch target (desktop: %s)', (isDesktop) => {
    stubMatchMedia(isDesktop)

    const { container } = render(<App />)

    const interactive = [...container.querySelectorAll('a, button, input, select, textarea')]
    expect(interactive.length).toBeGreaterThan(0)
    expect(interactive.filter((element) => !hasTouchTargetSize(element)).map((element) => element.outerHTML)).toEqual(
      [],
    )
  })

  it.each([true, false])('labels every form field (desktop: %s)', (isDesktop) => {
    stubMatchMedia(isDesktop)

    const { container } = render(<App />)

    const fields = [...container.querySelectorAll<HTMLInputElement>('input, select, textarea')]
    expect(fields.length).toBeGreaterThan(0)
    expect(fields.filter((field) => (field.labels?.length ?? 0) === 0).map((field) => field.outerHTML)).toEqual([])
  })
})
