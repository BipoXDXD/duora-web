import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JoinWaitlistForm } from './JoinWaitlistForm.tsx'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

function respondWith(status: number, headers: Record<string, string> = {}) {
  fetchMock.mockResolvedValue(new Response(null, { status, headers }))
}

async function submitEmail(email: string) {
  const user = userEvent.setup()
  render(<JoinWaitlistForm />)
  if (email !== '') {
    await user.type(screen.getByLabelText('E-mail'), email)
  }
  await user.click(screen.getByRole('button', { name: 'Entrar na lista' }))
  return user
}

describe('JoinWaitlistForm', () => {
  it('sends the typed e-mail to the waitlist', async () => {
    respondWith(202)

    await submitEmail('ana@example.com')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/waitlist',
      expect.objectContaining({ method: 'POST', body: '{"email":"ana@example.com"}' }),
    )
  })

  it('confirms the sign-up and hides the form on 202', async () => {
    respondWith(202)

    await submitEmail('ana@example.com')

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Pronto! Vamos avisar você por e-mail quando o Duora abrir.',
    )
    expect(screen.queryByLabelText('E-mail')).not.toBeInTheDocument()
  })

  it.each(['', '   '])('asks for the e-mail without calling the API when it is blank: %j', async (email) => {
    await submitEmail(email)

    expect(screen.getByRole('alert')).toHaveTextContent('Informe seu e-mail.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('says the e-mail is invalid on 400 and keeps what was typed', async () => {
    respondWith(400)

    await submitEmail('ana@')

    expect(await screen.findByRole('alert')).toHaveTextContent('Confira o e-mail: ele não parece válido.')
    expect(screen.getByLabelText('E-mail')).toHaveValue('ana@')
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true')
  })

  it.each([
    ['1800', 'Muitas tentativas. Tente de novo em 30 minutos.'],
    ['61', 'Muitas tentativas. Tente de novo em 2 minutos.'],
    ['60', 'Muitas tentativas. Tente de novo em 1 minuto.'],
    ['1', 'Muitas tentativas. Tente de novo em 1 minuto.'],
    ['0', 'Muitas tentativas. Tente de novo em 1 minuto.'],
  ])('tells how long to wait on 429 with Retry-After %s', async (retryAfter, message) => {
    respondWith(429, { 'Retry-After': retryAfter })

    await submitEmail('ana@example.com')

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('asks to try later on 429 without Retry-After', async () => {
    respondWith(429)

    await submitEmail('ana@example.com')

    expect(await screen.findByRole('alert')).toHaveTextContent('Muitas tentativas. Tente de novo mais tarde.')
  })

  it.each([
    ['the API fails', () => respondWith(500)],
    ['the network is down', () => fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))],
  ])('shows a generic error when %s', async (_case, arrange) => {
    arrange()

    await submitEmail('ana@example.com')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível enviar agora. Tente de novo em instantes.',
    )
    expect(screen.getByLabelText('E-mail')).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('disables the button while sending', async () => {
    let answer: ((response: Response) => void) | undefined
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve
      }),
    )

    await submitEmail('ana@example.com')

    expect(screen.getByRole('button', { name: 'Enviando…' })).toBeDisabled()
    answer?.(new Response(null, { status: 202 }))
    expect(await screen.findByRole('status')).toBeInTheDocument()
  })

  it('lets the visitor fix the e-mail and send again after an error', async () => {
    respondWith(400)
    const user = await submitEmail('ana@')
    await screen.findByRole('alert')
    respondWith(202)

    await user.type(screen.getByLabelText('E-mail'), 'example.com')
    await user.click(screen.getByRole('button', { name: 'Entrar na lista' }))

    expect(await screen.findByRole('status')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/waitlist',
      expect.objectContaining({ body: '{"email":"ana@example.com"}' }),
    )
  })
})
