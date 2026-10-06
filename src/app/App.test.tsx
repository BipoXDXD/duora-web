import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { ANONYMOUS_SESSION, stubApi } from '../test/fakeApi.ts'
import { stubMatchMedia } from '../test/fakeMatchMedia.ts'
import { elementsWithoutTouchTarget } from '../test/touchTarget.ts'
import { App } from './App.tsx'

/** Os estados da sessão têm testes próprios (SessionControls.test.tsx); aqui a visita é anônima. */
beforeEach(() => {
  stubApi(ANONYMOUS_SESSION)
})

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

  it.each([true, false])('offers the waitlist sign-up (desktop: %s)', (isDesktop) => {
    stubMatchMedia(isDesktop)

    render(<App />)

    expect(screen.getByRole('button', { name: 'Entrar na lista' })).toBeInTheDocument()
  })

  it.each([true, false])(
    'gives every link, button and field a 44×44px touch target (desktop: %s)',
    async (isDesktop) => {
      stubMatchMedia(isDesktop)

      const { container } = render(<App />)

      await screen.findByRole('link', { name: 'Entrar' })
      expect(container.querySelectorAll('a, button, input').length).toBeGreaterThan(0)
      expect(elementsWithoutTouchTarget(container)).toEqual([])
    },
  )

  it.each([true, false])('labels every form field (desktop: %s)', (isDesktop) => {
    stubMatchMedia(isDesktop)

    const { container } = render(<App />)

    const fields = [...container.querySelectorAll<HTMLInputElement>('input, select, textarea')]
    expect(fields.length).toBeGreaterThan(0)
    expect(fields.filter((field) => (field.labels?.length ?? 0) === 0).map((field) => field.outerHTML)).toEqual([])
  })
})
