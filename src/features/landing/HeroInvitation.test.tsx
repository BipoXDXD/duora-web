import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubMatchMedia } from '../../test/fakeMatchMedia.ts'
import { HeroInvitation } from './HeroInvitation.tsx'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'
const ROTATION_MS = 3500
const FIRST = 'vamos jogar adivinha o desenho com quem você ainda não conhece'
const SECOND = 'vamos jogar quiz a dois com alguém da sua cidade'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

function renderInvitation({ reducedMotion = false } = {}) {
  stubMatchMedia(false, { [REDUCED_MOTION]: reducedMotion })
  render(<HeroInvitation titleId="hero-title" />)
}

/** Clique síncrono: o userEvent espera por timers, e aqui o relógio é falso. */
function click(name: string) {
  fireEvent.click(screen.getByRole('button', { name }))
}

function heading() {
  return screen.getByRole('heading', { level: 1 })
}

function waitRotations(count: number) {
  act(() => {
    vi.advanceTimersByTime(ROTATION_MS * count)
  })
}

describe('HeroInvitation', () => {
  it('starts with the first game and the first person', () => {
    renderInvitation()

    expect(heading()).toHaveTextContent(FIRST)
    expect(heading()).toHaveAttribute('id', 'hero-title')
  })

  it('moves to the next combination every few seconds', () => {
    renderInvitation()

    waitRotations(1)

    expect(heading()).toHaveTextContent(SECOND)
  })

  it('goes back to the first combination after the last one', () => {
    renderInvitation()

    waitRotations(4)

    expect(heading()).toHaveTextContent(FIRST)
  })

  it('stays still for visitors who prefer reduced motion, offering to resume', () => {
    renderInvitation({ reducedMotion: true })

    waitRotations(3)

    expect(heading()).toHaveTextContent(FIRST)
    expect(screen.getByRole('button', { name: 'Retomar a frase' })).toBeInTheDocument()
  })

  it('pauses and resumes the rotation', () => {
    renderInvitation()

    click('Pausar a frase')
    waitRotations(2)
    expect(heading()).toHaveTextContent(FIRST)

    click('Retomar a frase')
    waitRotations(1)
    expect(heading()).toHaveTextContent(SECOND)
  })

  it('shows another combination on demand and announces it politely', () => {
    renderInvitation({ reducedMotion: true })

    click('Outra combinação')

    expect(heading()).toHaveTextContent(SECOND)
    expect(screen.getByRole('status')).toHaveTextContent(SECOND)
  })

  it('does not announce the automatic changes, which would interrupt the screen reader', () => {
    renderInvitation()

    waitRotations(1)

    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('gives both controls a 44×44px touch target', () => {
    renderInvitation()

    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveClass('min-h-11', 'min-w-11')
    }
  })
})
