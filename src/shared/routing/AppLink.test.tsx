import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { AppLink } from './AppLink.tsx'
import { usePathname } from './history.ts'

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

/**
 * Clica e diz se o app deixou o clique para o navegador. Depois o clique é cancelado de qualquer jeito,
 * porque o jsdom não navega para outro documento.
 */
function clickLeftToBrowser(link: HTMLElement, init: MouseEventInit): boolean {
  let leftToBrowser = false
  const observe = (event: Event) => {
    leftToBrowser = !event.defaultPrevented
    event.preventDefault()
  }
  window.addEventListener('click', observe)
  fireEvent.click(link, init)
  window.removeEventListener('click', observe)
  return leftToBrowser
}

function CurrentPath() {
  return <p data-testid="path">{usePathname()}</p>
}

function renderLink() {
  render(
    <>
      <AppLink to="/perfil" className="min-h-11 min-w-11">
        Meu perfil
      </AppLink>
      <CurrentPath />
    </>,
  )
}

describe('AppLink', () => {
  it('is a real link to the path, so it opens in a new tab and works without JavaScript', () => {
    renderLink()

    expect(screen.getByRole('link', { name: 'Meu perfil' })).toHaveAttribute('href', '/perfil')
  })

  it('changes the page without reloading it', async () => {
    renderLink()

    await userEvent.click(screen.getByRole('link', { name: 'Meu perfil' }))

    expect(window.location.pathname).toBe('/perfil')
    expect(screen.getByTestId('path')).toHaveTextContent('/perfil')
  })

  it('follows the browser back button', async () => {
    renderLink()
    await userEvent.click(screen.getByRole('link', { name: 'Meu perfil' }))

    window.history.back()

    expect(await screen.findByText('/')).toBeInTheDocument()
  })

  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['Cmd', { metaKey: true }],
    ['Shift', { shiftKey: true }],
    ['Alt', { altKey: true }],
  ])('leaves a %s+click to the browser, which opens a new tab or window', (_key, modifiers) => {
    renderLink()

    const leftToBrowser = clickLeftToBrowser(screen.getByRole('link', { name: 'Meu perfil' }), modifiers)

    expect(leftToBrowser).toBe(true)
    expect(window.location.pathname).toBe('/')
  })

  it('leaves a middle click to the browser', () => {
    renderLink()

    const leftToBrowser = clickLeftToBrowser(screen.getByRole('link', { name: 'Meu perfil' }), { button: 1 })

    expect(leftToBrowser).toBe(true)
    expect(window.location.pathname).toBe('/')
  })
})
