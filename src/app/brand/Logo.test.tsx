import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Logo } from './Logo.tsx'

describe('Logo', () => {
  it('is an image named Duora', () => {
    render(<Logo />)

    expect(screen.getByRole('img', { name: 'Duora' })).toBeInTheDocument()
  })

  it('draws the letters as paths, so it does not depend on a loaded font', () => {
    const { container } = render(<Logo />)

    expect(container.querySelector('text')).toBeNull()
    expect(container.querySelectorAll('path').length).toBeGreaterThan(0)
  })

  it('draws the "o" as two rings, one in the primary color and one in the accent', () => {
    const { container } = render(<Logo />)

    const rings = [...container.querySelectorAll('circle')].map((ring) => ring.getAttribute('class') ?? '')
    expect(rings.some((ring) => ring.includes('stroke-primary'))).toBe(true)
    expect(rings.some((ring) => ring.includes('stroke-accent'))).toBe(true)
  })

  it('moves the rings on hover only when the visitor allows motion', () => {
    const { container } = render(<Logo />)

    const moving = [...container.querySelectorAll('[class*="translate"]')].map((ring) => ring.getAttribute('class') ?? '')
    const classes = moving.flatMap((ring) => ring.split(/\s+/)).filter((name) => name.includes('translate'))
    expect(classes).toContain('motion-safe:group-hover:-translate-x-1')
    expect(classes).toContain('motion-safe:group-hover:translate-x-1')
    expect(classes.filter((name) => !name.startsWith('motion-safe:'))).toEqual([])
  })

  it('gives each copy its own clip path id, so two logos on the page do not clash', () => {
    const { container } = render(
      <>
        <Logo />
        <Logo />
      </>,
    )

    const ids = [...container.querySelectorAll('clipPath')].map((clip) => clip.id)
    expect(new Set(ids).size).toBe(2)
  })
})
