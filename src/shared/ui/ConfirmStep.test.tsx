import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmStep } from './ConfirmStep.tsx'

function renderStep(isPending: boolean, handlers = { onConfirm: vi.fn<() => void>(), onBack: vi.fn<() => void>() }) {
  render(
    <ConfirmStep
      confirmLabel="Sim, cancelar"
      pendingLabel="Cancelando…"
      backLabel="Manter inscrição"
      isPending={isPending}
      onConfirm={handlers.onConfirm}
      onBack={handlers.onBack}
    >
      <p>Cancelar sua inscrição?</p>
    </ConfirmStep>,
  )
  return handlers
}

describe('ConfirmStep', () => {
  it('asks the question and puts the focus on the confirmation', () => {
    renderStep(false)

    expect(screen.getByText('Cancelar sua inscrição?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sim, cancelar' })).toHaveFocus()
  })

  it('confirms or goes back', async () => {
    const user = userEvent.setup()
    const { onConfirm, onBack } = renderStep(false)

    await user.click(screen.getByRole('button', { name: 'Sim, cancelar' }))
    await user.click(screen.getByRole('button', { name: 'Manter inscrição' }))

    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('locks both choices while the action is pending', () => {
    renderStep(true)

    expect(screen.getByRole('button', { name: 'Cancelando…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Manter inscrição' })).toBeDisabled()
  })

  it('offers "Voltar" when no other way back is named', () => {
    render(
      <ConfirmStep confirmLabel="Sim" pendingLabel="…" isPending={false} onConfirm={() => {}} onBack={() => {}}>
        <p>Publicar?</p>
      </ConfirmStep>,
    )

    expect(screen.getByRole('button', { name: 'Voltar' })).toBeInTheDocument()
  })
})
