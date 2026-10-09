import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { userEvent } from '@testing-library/user-event'
import { FocusReturnButton } from './FocusReturnButton.tsx'

describe('FocusReturnButton', () => {
  it('takes the focus when it comes back from a step the person cancelled', () => {
    render(<FocusReturnButton hasFocus onClick={() => {}}>Editar perfil</FocusReturnButton>)

    expect(screen.getByRole('button', { name: 'Editar perfil' })).toHaveFocus()
  })

  it('leaves the focus alone the first time it appears', () => {
    render(<FocusReturnButton hasFocus={false} onClick={() => {}}>Editar perfil</FocusReturnButton>)

    expect(screen.getByRole('button', { name: 'Editar perfil' })).not.toHaveFocus()
  })

  it('is a plain button that does not submit a form', async () => {
    const onClick = vi.fn<() => void>()
    const onSubmit = vi.fn<() => void>()
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <FocusReturnButton hasFocus={false} onClick={onClick}>
          Desbloquear
        </FocusReturnButton>
      </form>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Desbloquear' }))

    expect(onClick).toHaveBeenCalledOnce()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('is described by the element it points to', () => {
    render(
      <>
        <p id="account">Conta 1a2b3c4d</p>
        <FocusReturnButton hasFocus={false} describedBy="account" onClick={() => {}}>
          Desbloquear
        </FocusReturnButton>
      </>,
    )

    expect(screen.getByRole('button', { name: 'Desbloquear' })).toHaveAccessibleDescription('Conta 1a2b3c4d')
  })
})
