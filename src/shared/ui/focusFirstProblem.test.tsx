import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { focusFirstProblem } from './focusFirstProblem.ts'

const FIELDS = ['name', 'bio'] as const

function renderForm(): HTMLFormElement {
  render(
    <form aria-label="Perfil">
      <input aria-label="Nome" name="name" />
      <textarea aria-label="Apresentação" name="bio" />
    </form>,
  )
  const form = screen.getByRole('form', { name: 'Perfil' })
  if (!(form instanceof HTMLFormElement)) {
    throw new Error('o papel form não veio de um <form>')
  }
  return form
}

describe('focusFirstProblem', () => {
  it('focuses the first field with a problem, in the order of the form', () => {
    const form = renderForm()

    focusFirstProblem(form, FIELDS, { bio: 'tooLong', name: 'required' })

    expect(screen.getByLabelText('Nome')).toHaveFocus()
  })

  it('skips the fields without a problem', () => {
    const form = renderForm()

    focusFirstProblem(form, FIELDS, { bio: 'tooLong' })

    expect(screen.getByLabelText('Apresentação')).toHaveFocus()
  })

  it('leaves the focus alone when no field has a problem', () => {
    const form = renderForm()

    focusFirstProblem(form, FIELDS, {})

    expect(document.body).toHaveFocus()
  })

  it('does nothing before the form is on the screen', () => {
    expect(() => focusFirstProblem(null, FIELDS, { name: 'required' })).not.toThrow()
  })
})
