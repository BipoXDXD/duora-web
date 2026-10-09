import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { Component, type ReactNode } from 'react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LOGIN_URL } from '../auth/loginUrl.ts'
import {
  byMethod,
  inSequence,
  jsonAnswer,
  networkFailure,
  problemAnswer,
  refusalAnswer,
  stubApi,
  type FakeRoute,
} from '../../test/fakeApi.ts'
import { elementsWithoutTouchTarget } from '../../test/touchTarget.ts'
import { RoundChatPanel } from './RoundChatPanel.tsx'

const EVENT_ID = '0199b0c4-7f3a-7c2e-9a1b-2c3d4e5f6a7b'
const CHAT = `/api/events/${EVENT_ID}/rounds/2/chat`
const MESSAGES = `${CHAT}/messages`
const CHAT_ID = '0199b0c4-7f3a-7c2e-9a1b-2c3d4e5f6a7d'
const KEY_1 = '0199b0c4-0000-7000-8000-000000000001'
const KEY_2 = '0199b0c4-0000-7000-8000-000000000002'

const OPEN = jsonAnswer({ chatId: CHAT_ID, open: true, lastSeq: 0 })
const CLOSED = jsonAnswer({ chatId: CHAT_ID, open: false, lastSeq: 2 })

function after(seq: number): string {
  return `${MESSAGES}?afterSeq=${seq}&maxPageSize=100`
}

function message(seq: number, text: string, fromMe = false) {
  return { seq, fromMe, text, sentAt: '2026-10-10T23:05:00Z' }
}

function page(items: readonly ReturnType<typeof message>[], nextAfterSeq: number | null = null): FakeRoute {
  return jsonAnswer({ items, nextAfterSeq })
}

const EMPTY = page([])

function busy(status: number, seconds: number): FakeRoute {
  return () => Promise.resolve(new Response(null, { status, headers: { 'Retry-After': String(seconds) } }))
}

/** Uma resposta que o teste solta quando quiser, para ver a tela no meio do envio. */
function held() {
  let release: ((answer: FakeRoute) => void) | undefined
  const route: FakeRoute = (init) =>
    new Promise<Response>((resolve) => {
      release = (answer) => void answer(init).then(resolve)
    })
  return { route, release: (answer: FakeRoute) => release?.(answer) }
}

let visibility: DocumentVisibilityState = 'visible'

function setVisibility(state: DocumentVisibilityState) {
  visibility = state
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  // A Testing Library só espera com relógio falso se achar o `jest`. Andar 0 ms deixa as respostas chegarem sem
  // mexer no intervalo do polling, que só o teste adianta, com `wait`.
  vi.stubGlobal('jest', { advanceTimersByTime: () => vi.advanceTimersByTime(0) })
  visibility = 'visible'
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
  vi.spyOn(Math, 'random').mockReturnValue(0)
  vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(KEY_1).mockReturnValueOnce(KEY_2)
})

afterEach(() => {
  vi.useRealTimers()
})

function renderChat(routes: Readonly<Record<string, FakeRoute>>) {
  const fetchMock = stubApi(routes)
  render(<RoundChatPanel eventId={EVENT_ID} roundNumber={2} />)
  return { fetchMock, user: userEvent.setup({ delay: null }) }
}

/** Passa o relógio falso e deixa as respostas (promessas) chegarem. */
async function wait(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms))
}

function readsOf(fetchMock: ReturnType<typeof stubApi>): string[] {
  return fetchMock.mock.calls
    .filter(([, init]) => (init?.method ?? 'GET') === 'GET')
    .map(([path]) => String(path))
}

function sendsOf(fetchMock: ReturnType<typeof stubApi>) {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method === 'POST')
    .map(([, init]) => ({
      key: new Headers(init?.headers).get('Idempotency-Key'),
      body: init?.body,
    }))
}

function log() {
  return screen.getByRole('log')
}

function shownTexts(): string[] {
  return within(log())
    .queryAllByRole('listitem')
    .map((item) => item.querySelector('[data-message-text]')?.textContent ?? '')
}

function field() {
  return screen.getByRole('textbox', { name: 'Sua mensagem' })
}

describe('RoundChatPanel', () => {
  describe('reading', () => {
    it('reads whether the chat is open, then the messages from the start, in the order of their position', async () => {
      const { fetchMock } = renderChat({
        [CHAT]: OPEN,
        [after(0)]: page([message(1, 'Oi!'), message(2, 'Oi, tudo bem?', true)]),
      })

      expect(await screen.findByText('Oi, tudo bem?')).toBeInTheDocument()
      expect(shownTexts()).toEqual(['Oi!', 'Oi, tudo bem?'])
      expect(readsOf(fetchMock)).toEqual([CHAT, after(0)])
    })

    it('says who wrote each message', async () => {
      renderChat({ [CHAT]: OPEN, [after(0)]: page([message(1, 'Oi!'), message(2, 'Olá!', true)]) })

      const [partner, own] = await screen.findAllByRole('listitem')
      expect(partner).toHaveTextContent(/^Sua dupla/)
      expect(own).toHaveTextContent(/^Você/)
    })

    it('shows a message as text, never as markup', async () => {
      renderChat({ [CHAT]: OPEN, [after(0)]: page([message(1, '<b>oi</b>\nlinha 2')]) })

      const text = await screen.findByText(/<b>oi<\/b>/)
      expect(text.textContent).toBe('<b>oi</b>\nlinha 2')
      expect(log().querySelector('b')).toBeNull()
    })

    // O jsdom não faz layout: o teste guarda a regra de CSS que a revisão num Chromium real mostrou necessária
    // (500 caracteres sem espaço alargavam a página com `break-words`), não a largura em si.
    it('lets a message with no spaces break anywhere, so it never widens the page', async () => {
      renderChat({ [CHAT]: OPEN, [after(0)]: page([message(1, 'A'.repeat(500))]) })

      const bubble = (await screen.findByText('A'.repeat(500))).closest('p')
      expect(bubble).toHaveClass('wrap-anywhere')
    })

    it('asks for the next messages every 2 seconds, from the last position it has', async () => {
      const { fetchMock } = renderChat({
        [CHAT]: OPEN,
        [after(0)]: page([message(1, 'Oi!')]),
        [after(1)]: inSequence(EMPTY, page([message(2, 'Tudo bem?')]), EMPTY),
        [after(2)]: EMPTY,
      })
      await screen.findByText('Oi!')

      await wait(1999)
      expect(readsOf(fetchMock)).toEqual([CHAT, after(0)])
      await wait(1)
      await wait(2000)
      expect(shownTexts()).toEqual(['Oi!', 'Tudo bem?'])
      await wait(2000)
      expect(readsOf(fetchMock)).toEqual([CHAT, after(0), after(1), after(1), after(2)])
    })

    it('shows each message once when a read brings it again', async () => {
      renderChat({
        [CHAT]: OPEN,
        [after(0)]: page([message(1, 'Oi!')]),
        [after(1)]: page([message(1, 'Oi!'), message(2, 'Tudo bem?')]),
        [after(2)]: EMPTY,
      })
      await screen.findByText('Oi!')

      await wait(2000)

      expect(shownTexts()).toEqual(['Oi!', 'Tudo bem?'])
    })

    it('reads the following pages at once when the API says there are more', async () => {
      const { fetchMock } = renderChat({
        [CHAT]: OPEN,
        [after(0)]: page([message(1, 'Um')], 1),
        [after(1)]: page([message(2, 'Dois')]),
      })

      expect(await screen.findByText('Dois')).toBeInTheDocument()
      expect(readsOf(fetchMock)).toEqual([CHAT, after(0), after(1)])
    })

    it('shows that the chat is still empty', async () => {
      renderChat({ [CHAT]: OPEN, [after(0)]: EMPTY })

      expect(await screen.findByText('Nenhuma mensagem ainda.')).toBeInTheDocument()
    })

    it('shows that it is loading', () => {
      renderChat({ [CHAT]: () => new Promise<Response>(() => undefined) })

      expect(screen.getByText('Carregando a conversa…')).toBeInTheDocument()
    })

    it('says there is no conversation for someone the API does not find in a pair, without reading messages', async () => {
      const { fetchMock } = renderChat({ [CHAT]: problemAnswer(404) })

      expect(await screen.findByText('Não há conversa sua nesta rodada.')).toBeInTheDocument()
      await wait(10_000)
      expect(readsOf(fetchMock)).toEqual([CHAT])
    })

    it('stops when the messages are not found any more', async () => {
      const { fetchMock } = renderChat({ [CHAT]: OPEN, [after(0)]: problemAnswer(404) })

      expect(await screen.findByText('Não há conversa sua nesta rodada.')).toBeInTheDocument()
      await wait(10_000)
      expect(readsOf(fetchMock)).toEqual([CHAT, after(0)])
    })
  })

  describe('tab visibility', () => {
    it('does not read while the tab is hidden', async () => {
      const { fetchMock } = renderChat({ [CHAT]: OPEN, [after(0)]: EMPTY })
      await screen.findByText('Nenhuma mensagem ainda.')

      setVisibility('hidden')
      await wait(60_000)

      expect(readsOf(fetchMock)).toEqual([CHAT, after(0)])
    })

    it('reads the chat again and the messages since the cursor when the tab comes back', async () => {
      const { fetchMock } = renderChat({
        [CHAT]: OPEN,
        [after(0)]: page([message(1, 'Oi!')]),
        [after(1)]: page([message(2, 'Sumiu?')]),
        [after(2)]: EMPTY,
      })
      await screen.findByText('Oi!')
      setVisibility('hidden')
      await wait(60_000)

      setVisibility('visible')

      expect(await screen.findByText('Sumiu?')).toBeInTheDocument()
      expect(readsOf(fetchMock)).toEqual([CHAT, after(0), CHAT, after(1)])
    })

    it('does not start reading while the tab opens hidden', async () => {
      visibility = 'hidden'
      const { fetchMock } = renderChat({ [CHAT]: OPEN, [after(0)]: EMPTY })

      await wait(10_000)

      expect(fetchMock).not.toHaveBeenCalled()
      expect(screen.getByText('Carregando a conversa…')).toBeInTheDocument()
    })
  })

  describe('reads on their way', () => {
    it('stops reading when the panel goes away', async () => {
      const read = held()
      const fetchMock = stubApi({ [CHAT]: OPEN, [after(0)]: read.route })
      const { unmount } = render(<RoundChatPanel eventId={EVENT_ID} roundNumber={2} />)
      await wait(0)

      unmount()
      read.release(page([message(1, 'Oi!')]))
      await wait(10_000)

      expect(readsOf(fetchMock)).toEqual([CHAT, after(0)])
    })

    it('stops before the messages when the panel goes away while the chat is read', async () => {
      const read = held()
      const fetchMock = stubApi({ [CHAT]: read.route, [after(0)]: EMPTY })
      const { unmount } = render(<RoundChatPanel eventId={EVENT_ID} roundNumber={2} />)
      await wait(0)

      unmount()
      read.release(OPEN)
      await wait(10_000)

      expect(readsOf(fetchMock)).toEqual([CHAT])
    })

    it('does not mark the next read when the tab was hidden while a read was on its way', async () => {
      const read = held()
      const { fetchMock } = renderChat({ [CHAT]: OPEN, [after(0)]: read.route })
      await wait(0)

      setVisibility('hidden')
      read.release(EMPTY)
      await wait(60_000)

      expect(readsOf(fetchMock)).toEqual([CHAT, after(0)])
    })

    it('reads the chat again after the read on its way when the tab comes back during it', async () => {
      const read = held()
      const { fetchMock } = renderChat({ [CHAT]: OPEN, [after(0)]: inSequence(read.route, EMPTY) })
      await wait(0)
      setVisibility('hidden')
      setVisibility('visible')
      expect(readsOf(fetchMock)).toEqual([CHAT, after(0)])

      read.release(EMPTY)
      await wait(2000)

      expect(readsOf(fetchMock)).toEqual([CHAT, after(0), CHAT, after(0)])
    })
  })

  describe('bugs', () => {
    it('lets a bug in the reading reach the error boundary, instead of calling it a lost connection', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      stubApi({ [CHAT]: () => Promise.reject(new RangeError('bug')) })

      render(
        <CrashBoundary>
          <RoundChatPanel eventId={EVENT_ID} roundNumber={2} />
        </CrashBoundary>,
      )

      expect(await screen.findByText('quebrou: bug')).toBeInTheDocument()
    })

    it('lets a bug in the sending reach the error boundary', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      stubApi({
        [CHAT]: OPEN,
        [after(0)]: EMPTY,
        [MESSAGES]: byMethod({ POST: () => Promise.reject(new RangeError('bug no envio')) }),
      })
      render(
        <CrashBoundary>
          <RoundChatPanel eventId={EVENT_ID} roundNumber={2} />
        </CrashBoundary>,
      )
      await screen.findByText('Nenhuma mensagem ainda.')

      fireEvent.change(field(), { target: { value: 'Oi' } })
      fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))

      expect(await screen.findByText('quebrou: bug no envio')).toBeInTheDocument()
    })

    it('lets a bug in a resend reach the error boundary', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      stubApi({
        [CHAT]: OPEN,
        [after(0)]: EMPTY,
        [MESSAGES]: byMethod({ POST: inSequence(networkFailure(), () => Promise.reject(new RangeError('bug no reenvio'))) }),
      })
      render(
        <CrashBoundary>
          <RoundChatPanel eventId={EVENT_ID} roundNumber={2} />
        </CrashBoundary>,
      )
      await screen.findByText('Nenhuma mensagem ainda.')
      fireEvent.change(field(), { target: { value: 'Oi' } })
      fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))

      fireEvent.click(await screen.findByRole('button', { name: 'Tentar enviar de novo' }))

      expect(await screen.findByText('quebrou: bug no reenvio')).toBeInTheDocument()
    })
  })

  describe('failed reads', () => {
    it('waits longer after each failure, says it is trying again, and goes back to 2 seconds', async () => {
      const { fetchMock } = renderChat({
        [CHAT]: OPEN,
        [after(0)]: inSequence(EMPTY, problemAnswer(500), networkFailure(), page([message(1, 'Voltei')]), EMPTY),
        [after(1)]: EMPTY,
      })
      await screen.findByText('Nenhuma mensagem ainda.')

      await wait(2000)
      expect(screen.getByText('Sem conexão com a conversa. Tentando de novo…')).toBeInTheDocument()
      await wait(3999)
      expect(readsOf(fetchMock)).toHaveLength(3)
      await wait(1)
      expect(readsOf(fetchMock)).toHaveLength(4)
      await wait(8000)
      expect(screen.getByText('Voltei')).toBeInTheDocument()
      expect(screen.queryByText('Sem conexão com a conversa. Tentando de novo…')).not.toBeInTheDocument()
      await wait(2000)
      expect(readsOf(fetchMock)).toHaveLength(6)
    })

    it.each([429, 503])('waits the Retry-After of a %i', async (status) => {
      const { fetchMock } = renderChat({ [CHAT]: OPEN, [after(0)]: inSequence(EMPTY, busy(status, 10), EMPTY) })
      await screen.findByText('Nenhuma mensagem ainda.')
      await wait(2000)

      await wait(9999)
      expect(readsOf(fetchMock)).toHaveLength(3)
      await wait(1)
      expect(readsOf(fetchMock)).toHaveLength(4)
    })

    it('tries reading the chat again when the first read fails', async () => {
      renderChat({ [CHAT]: inSequence(problemAnswer(500), OPEN), [after(0)]: page([message(1, 'Oi!')]) })

      expect(await screen.findByText('Sem conexão com a conversa. Tentando de novo…')).toBeInTheDocument()
      await wait(4000)
      expect(screen.getByText('Oi!')).toBeInTheDocument()
    })
  })

  describe('closed chat', () => {
    it('shows the messages without the field and with a notice that does not say why', async () => {
      renderChat({ [CHAT]: CLOSED, [after(0)]: page([message(1, 'Oi!'), message(2, 'Até!', true)]) })

      expect(await screen.findByText('Até!')).toBeInTheDocument()
      expect(screen.getByText('Esta conversa não recebe mais mensagens. O que foi dito continua aqui para ler.')).toBeInTheDocument()
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Enviar' })).not.toBeInTheDocument()
    })

    it('stops reading once it has every message', async () => {
      const { fetchMock } = renderChat({ [CHAT]: CLOSED, [after(0)]: page([message(1, 'Oi!')]) })
      await screen.findByText('Oi!')

      await wait(60_000)

      expect(readsOf(fetchMock)).toEqual([CHAT, after(0)])
    })
  })

  describe('sending', () => {
    it('sends the text with a new key and shows it as pending until the API records it', async () => {
      const post = held()
      const { fetchMock, user } = chatWithSend(post.route, { [after(2)]: EMPTY })
      await screen.findByText('Oi!')

      await user.type(field(), 'Tudo bem?')
      await user.click(screen.getByRole('button', { name: 'Enviar' }))

      expect(sendsOf(fetchMock)).toEqual([{ key: KEY_1, body: '{"text":"Tudo bem?"}' }])
      expect(field()).toHaveValue('')
      expect(shownTexts()).toEqual(['Oi!', 'Tudo bem?'])
      expect(screen.getByText('Enviando…')).toBeInTheDocument()

      post.release(jsonAnswer(message(2, 'Tudo bem?', true), 201))
      await wait(0)

      expect(screen.queryByText('Enviando…')).not.toBeInTheDocument()
      expect(shownTexts()).toEqual(['Oi!', 'Tudo bem?'])
    })

    it('keeps the same item for the own message when the API records it, so it is not announced twice', async () => {
      const post = held()
      const { user } = chatWithSend(post.route)
      await screen.findByText('Oi!')
      await user.type(field(), 'Tudo bem?')
      await user.click(screen.getByRole('button', { name: 'Enviar' }))
      const pending = screen.getAllByRole('listitem')[1]

      post.release(jsonAnswer(message(2, 'Tudo bem?', true), 201))
      await wait(0)

      expect(screen.getAllByRole('listitem')[1]).toBe(pending)
    })

    it('announces new messages politely in a log', async () => {
      chatWithSend(jsonAnswer(message(2, 'x', true), 201))

      await screen.findByText('Oi!')

      expect(log()).toHaveAttribute('aria-live', 'polite')
      expect(log()).toHaveAttribute('aria-relevant', 'additions')
    })

    it('sends on Enter and breaks the line on Shift+Enter', async () => {
      const { fetchMock, user } = chatWithSend(jsonAnswer(message(2, 'linha 1\nlinha 2', true), 201))
      await screen.findByText('Oi!')

      await user.type(field(), 'linha 1{Shift>}{Enter}{/Shift}linha 2')
      expect(sendsOf(fetchMock)).toEqual([])
      await user.keyboard('{Enter}')

      expect(sendsOf(fetchMock)).toEqual([{ key: KEY_1, body: '{"text":"linha 1\\nlinha 2"}' }])
    })

    it('does not send on Enter while a character is being composed', async () => {
      const { fetchMock } = chatWithSend(jsonAnswer(message(2, 'x', true), 201))
      await screen.findByText('Oi!')
      fireEvent.change(field(), { target: { value: 'ã' } })

      fireEvent.keyDown(field(), { key: 'Enter', isComposing: true })

      expect(sendsOf(fetchMock)).toEqual([])
    })

    it('keeps the focus in the field after sending', async () => {
      const { user } = chatWithSend(jsonAnswer(message(2, 'Tudo bem?', true), 201))
      await screen.findByText('Oi!')

      await user.type(field(), 'Tudo bem?')
      await user.click(screen.getByRole('button', { name: 'Enviar' }))
      await wait(0)

      expect(field()).toHaveFocus()
    })

    it('offers to try again after a network failure and resends with the same key', async () => {
      const { fetchMock, user } = chatWithSend(
        inSequence(networkFailure(), jsonAnswer(message(2, 'Tudo bem?', true), 200)),
        { [after(2)]: EMPTY },
      )
      await screen.findByText('Oi!')
      await user.type(field(), 'Tudo bem?{Enter}')
      expect(await screen.findByText('Não foi enviada.')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Tentar enviar de novo' }))
      await wait(0)

      expect(sendsOf(fetchMock)).toEqual([
        { key: KEY_1, body: '{"text":"Tudo bem?"}' },
        { key: KEY_1, body: '{"text":"Tudo bem?"}' },
      ])
      expect(screen.queryByText('Não foi enviada.')).not.toBeInTheDocument()
      expect(shownTexts()).toEqual(['Oi!', 'Tudo bem?'])
      expect(field()).toHaveFocus()
    })

    it.each([429, 503])('says when to try again after a %i, and resends with the same key', async (status) => {
      const { fetchMock, user } = chatWithSend(inSequence(busy(status, 7), jsonAnswer(message(2, 'Oi?', true), 201)))
      await screen.findByText('Oi!')
      await user.type(field(), 'Oi?{Enter}')

      expect(await screen.findByText('Não foi enviada. Tente de novo em 7 s.')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Tentar enviar de novo' }))
      await wait(0)

      expect(sendsOf(fetchMock).map(({ key }) => key)).toEqual([KEY_1, KEY_1])
    })

    it('uses a new key for each new text', async () => {
      const { fetchMock, user } = chatWithSend(
        inSequence(jsonAnswer(message(2, 'Um', true), 201), jsonAnswer(message(3, 'Dois', true), 201)),
      )
      await screen.findByText('Oi!')

      await user.type(field(), 'Um{Enter}')
      await user.type(field(), 'Dois{Enter}')

      expect(sendsOf(fetchMock).map(({ key }) => key)).toEqual([KEY_1, KEY_2])
    })

    it('turns read-only on CHAT_CLOSED, without saying why, and reads the chat again', async () => {
      const { fetchMock, user } = chatWithSend(refusalAnswer(409, 'CHAT_CLOSED'), {
        [CHAT]: inSequence(OPEN, CLOSED),
      })
      await screen.findByText('Oi!')

      await user.type(field(), 'Ainda aí?{Enter}')

      expect(await screen.findByText('Esta conversa não recebe mais mensagens. O que foi dito continua aqui para ler.')).toBeInTheDocument()
      expect(screen.getByText('Não foi enviada.')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Tentar enviar de novo' })).not.toBeInTheDocument()
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      expect(readsOf(fetchMock).filter((path) => path === CHAT)).toHaveLength(2)
    })

    it('marks the text as not sent, with nothing to retry, on IDEMPOTENCY_KEY_REUSED', async () => {
      const { user } = chatWithSend(refusalAnswer(409, 'IDEMPOTENCY_KEY_REUSED'))
      await screen.findByText('Oi!')

      await user.type(field(), 'Oi?{Enter}')

      expect(await screen.findByText('Não foi enviada.')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Tentar enviar de novo' })).not.toBeInTheDocument()
      expect(field()).toBeInTheDocument()
    })

    it('asks to sign in again when the session ended', async () => {
      const { user } = chatWithSend(problemAnswer(401))
      await screen.findByText('Oi!')

      await user.type(field(), 'Oi?{Enter}')

      expect(await screen.findByText('Sua sessão terminou. Entre de novo para enviar.')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Entrar de novo' })).toHaveAttribute('href', LOGIN_URL)
    })

    it.each([
      ['TOO_LONG', 'A mensagem passou de 500 caracteres. Encurte para enviar.'],
      ['FORBIDDEN_CHARACTER', 'A mensagem tem um caractere que não é aceito. Tire-o e envie de novo.'],
      ['UNKNOWN_FIELD', 'A mensagem não foi aceita. Revise o texto e envie de novo.'],
    ])('gives the text back with the reason when the API refuses it with %s', async (code, problem) => {
      const { user } = chatWithSend(problemAnswer(400, 'Bad Request', [{ field: 'text', code }]))
      await screen.findByText('Oi!')

      await user.type(field(), 'Oi​{Enter}')

      expect(await screen.findByText(problem)).toBeInTheDocument()
      expect(field()).toHaveValue('Oi​')
      expect(field()).toHaveAttribute('aria-invalid', 'true')
      expect(shownTexts()).toEqual(['Oi!'])
    })
  })

  it('keeps a new draft when the API refuses the previous text', async () => {
    const post = held()
    const { user } = chatWithSend(post.route)
    await screen.findByText('Oi!')
    await user.type(field(), 'Oi\u200b{Enter}')
    await user.type(field(), 'Outra')

    post.release(problemAnswer(400, 'Bad Request', [{ field: 'text', code: 'FORBIDDEN_CHARACTER' }]))
    await wait(0)

    expect(field()).toHaveValue('Outra')
    expect(screen.getByText('A mensagem tem um caractere que não é aceito. Tire-o e envie de novo.')).toBeInTheDocument()
  })

  describe('draft', () => {
    it('labels the field and counts characters as the API does', async () => {
      chatToWrite()
      await screen.findByText('Nenhuma mensagem ainda.')

      fireEvent.change(field(), { target: { value: ' 😀é ' } })

      expect(field()).toHaveAccessibleDescription(expect.stringContaining('2 de 500 caracteres'))
    })

    it('does not send more than 500 characters and says why', async () => {
      const { fetchMock } = chatToWrite()
      await screen.findByText('Nenhuma mensagem ainda.')
      fireEvent.change(field(), { target: { value: 'a'.repeat(501) } })

      fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))

      expect(screen.getByText('A mensagem passou de 500 caracteres. Encurte para enviar.')).toBeInTheDocument()
      expect(field()).toHaveAttribute('aria-invalid', 'true')
      expect(sendsOf(fetchMock)).toEqual([])
    })

    it('sends exactly 500 characters', async () => {
      const { fetchMock } = chatToWrite()
      await screen.findByText('Nenhuma mensagem ainda.')
      fireEvent.change(field(), { target: { value: 'a'.repeat(500) } })

      fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))

      expect(sendsOf(fetchMock)).toHaveLength(1)
    })

    it('does not send a blank text', async () => {
      const { fetchMock, user } = chatToWrite()
      await screen.findByText('Nenhuma mensagem ainda.')

      await user.type(field(), '   {Enter}')

      expect(screen.getByText('Escreva uma mensagem antes de enviar.')).toBeInTheDocument()
      expect(sendsOf(fetchMock)).toEqual([])
    })

    it('clears the problem once the text is edited', async () => {
      const { user } = chatToWrite()
      await screen.findByText('Nenhuma mensagem ainda.')
      await user.type(field(), '{Enter}')

      await user.type(field(), 'a')

      expect(screen.queryByText('Escreva uma mensagem antes de enviar.')).not.toBeInTheDocument()
      expect(field()).toHaveAttribute('aria-invalid', 'false')
    })

    it('gives every control the 44px touch target', async () => {
      const { user } = chatWithFailedSend()
      await screen.findByText('Oi!')
      await user.type(field(), 'Oi?{Enter}')
      await screen.findByText('Não foi enviada.')

      expect(elementsWithoutTouchTarget(document.body)).toEqual([])
    })
  })
})

function chatWithFailedSend() {
  return renderChat({
    [CHAT]: OPEN,
    [after(0)]: page([message(1, 'Oi!')]),
    [MESSAGES]: byMethod({ POST: networkFailure() }),
  })
}

function chatWithSend(send: FakeRoute, more: Readonly<Record<string, FakeRoute>> = {}) {
  return renderChat({
    [CHAT]: OPEN,
    [after(0)]: page([message(1, 'Oi!')]),
    [after(1)]: EMPTY,
    [MESSAGES]: byMethod({ POST: send }),
    ...more,
  })
}

function chatToWrite() {
  return renderChat({
    [CHAT]: OPEN,
    [after(0)]: EMPTY,
    [MESSAGES]: byMethod({ POST: jsonAnswer(message(1, 'x', true), 201) }),
  })
}

class CrashBoundary extends Component<{ readonly children: ReactNode }, { readonly message: string | null }> {
  override state = { message: null }

  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : String(error) }
  }

  override render() {
    return this.state.message === null ? this.props.children : <p>{`quebrou: ${this.state.message}`}</p>
  }
}
