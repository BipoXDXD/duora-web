import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { stubMatchMedia } from '../../test/fakeMatchMedia.ts'
import { ThemeToggle } from './ThemeToggle.tsx'

const PREFERS_DARK = '(prefers-color-scheme: dark)'
const STORAGE_KEY = 'duora.theme'

afterEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

function blockStorage(): never {
  throw new DOMException('blocked', 'SecurityError')
}

function systemPrefersDark(prefersDark: boolean) {
  stubMatchMedia(false, { [PREFERS_DARK]: prefersDark })
}

describe('ThemeToggle', () => {
  it.each([
    [true, 'Usar tema claro'],
    [false, 'Usar tema escuro'],
  ])('offers the opposite of the system theme when nothing was picked (prefers dark: %s)', (prefersDark, label) => {
    systemPrefersDark(prefersDark)

    render(<ThemeToggle />)

    expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
  })

  it('follows the theme picked before over the system preference', () => {
    systemPrefersDark(true)
    localStorage.setItem(STORAGE_KEY, 'light')

    render(<ThemeToggle />)

    expect(screen.getByRole('button', { name: 'Usar tema escuro' })).toBeInTheDocument()
  })

  it('ignores a stored value that is not a theme', () => {
    systemPrefersDark(true)
    localStorage.setItem(STORAGE_KEY, 'sepia')

    render(<ThemeToggle />)

    expect(screen.getByRole('button', { name: 'Usar tema claro' })).toBeInTheDocument()
  })

  it('switches the page theme and remembers the choice', async () => {
    systemPrefersDark(true)
    const user = userEvent.setup()
    render(<ThemeToggle />)

    await user.click(screen.getByRole('button', { name: 'Usar tema claro' }))

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light')
    expect(screen.getByRole('button', { name: 'Usar tema escuro' })).toBeInTheDocument()
  })

  it('still switches the theme when the browser blocks storage', async () => {
    systemPrefersDark(true)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blockStorage)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blockStorage)
    const user = userEvent.setup()
    render(<ThemeToggle />)

    await user.click(screen.getByRole('button', { name: 'Usar tema claro' }))

    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('gives the button a 44×44px touch target', () => {
    systemPrefersDark(true)

    render(<ThemeToggle />)

    expect(screen.getByRole('button')).toHaveClass('min-h-11', 'min-w-11')
  })
})
