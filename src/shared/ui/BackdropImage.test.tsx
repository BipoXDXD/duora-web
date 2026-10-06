import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BackdropImage } from './BackdropImage.tsx'

function renderBackdrop(props: Partial<Parameters<typeof BackdropImage>[0]> = {}) {
  return render(<BackdropImage wideSrc="/backgrounds/hero.webp" isAboveTheFold={false} {...props} />)
}

describe('BackdropImage', () => {
  it('is decorative, so screen readers skip it', () => {
    const { container } = renderBackdrop()

    expect(container.querySelector('img')).toHaveAttribute('alt', '')
  })

  it('loads early and with high priority above the fold', () => {
    const { container } = renderBackdrop({ isAboveTheFold: true })

    const image = container.querySelector('img')
    expect(image).toHaveAttribute('loading', 'eager')
    expect(image).toHaveAttribute('fetchpriority', 'high')
  })

  it('loads lazily below the fold', () => {
    const { container } = renderBackdrop({ isAboveTheFold: false })

    const image = container.querySelector('img')
    expect(image).toHaveAttribute('loading', 'lazy')
    expect(image).not.toHaveAttribute('fetchpriority', 'high')
  })

  it('serves the portrait version below the desktop breakpoint and the wide one above it', () => {
    const { container } = renderBackdrop({ narrowSrc: '/backgrounds/hero-mobile.webp' })

    expect(container.querySelector('img')).toHaveAttribute('src', '/backgrounds/hero-mobile.webp')
    expect(container.querySelector('source')).toHaveAttribute('media', '(min-width: 48rem)')
    expect(container.querySelector('source')).toHaveAttribute('srcset', '/backgrounds/hero.webp')
  })

  it('serves the wide version everywhere when there is no portrait one', () => {
    const { container } = renderBackdrop()

    expect(container.querySelector('img')).toHaveAttribute('src', '/backgrounds/hero.webp')
    expect(container.querySelector('source')).toBeNull()
  })

  it('removes itself when the file fails to load, so the gradient behind it shows', () => {
    const { container } = renderBackdrop()

    fireEvent.error(container.querySelector('img') ?? document.body)

    expect(container.querySelector('img')).toBeNull()
  })
})
