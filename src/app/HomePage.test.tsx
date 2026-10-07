import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ANONYMOUS_SESSION, stubApi } from '../test/fakeApi.ts'
import { stubMatchMedia } from '../test/fakeMatchMedia.ts'
import { App } from './App.tsx'
import { HomePage } from './HomePage.tsx'

describe('HomePage', () => {
  it('sends the final call to the waitlist form in the hero', () => {
    stubMatchMedia(false)
    const { container } = render(<HomePage />)

    const finalCall = screen.getByRole('link', { name: 'Entrar na lista' })
    const target = container.querySelector(finalCall.getAttribute('href') ?? 'missing')

    if (!(target instanceof HTMLElement)) {
      throw new Error(`âncora ${finalCall.getAttribute('href') ?? ''} sem destino`)
    }
    expect(within(target).getByLabelText('E-mail')).toBeInTheDocument()
  })

  it('describes each step picture of "Como funciona" for screen readers', () => {
    stubMatchMedia(false)
    render(<HomePage />)

    const steps = within(screen.getByRole('region', { name: 'Como funciona' })).getAllByRole('img')
    expect(steps).toHaveLength(3)
    expect(steps.every((step) => (step.getAttribute('alt') ?? '').length > 0)).toBe(true)
  })

  it('loads only the hero picture eagerly', () => {
    stubMatchMedia(false)
    const { container } = render(<HomePage />)

    const eager = [...container.querySelectorAll('img')].filter((image) => image.getAttribute('loading') !== 'lazy')
    expect(eager.map((image) => image.getAttribute('src'))).toEqual(['/backgrounds/hero-mobile.webp'])
  })

  it('answers the questions in native disclosure widgets, closed at first', () => {
    stubMatchMedia(false)
    const { container } = render(<HomePage />)

    const questions = [...container.querySelectorAll('details')]
    expect(questions).toHaveLength(5)
    expect(questions.every((question) => !question.open && question.querySelector('summary') !== null)).toBe(true)
  })

  it('points every desktop section link to a section on the page', () => {
    stubMatchMedia(true)
    stubApi(ANONYMOUS_SESSION)
    const { container } = render(<App />)

    const links = within(screen.getByRole('navigation', { name: 'Principal' }))
      .getAllByRole('link')
      .map((link) => link.getAttribute('href') ?? '')
      .filter((href) => href.startsWith('/#'))
      .map((href) => href.slice(1))
    expect(links).toHaveLength(3)
    expect(links.filter((anchor) => container.querySelector(anchor) === null)).toEqual([])
  })
})
