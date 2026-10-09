import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LOGIN_URL } from '../auth/loginUrl.ts'
import {
  byMethod,
  inSequence,
  jsonAnswer,
  networkFailure,
  problemAnswer,
  statusAnswer,
  stubApi,
  type FakeRoute,
} from '../../test/fakeApi.ts'
import { elementsWithoutTouchTarget } from '../../test/touchTarget.ts'
import { RoundChatPanel } from './RoundChatPanel.tsx'

const EVENT_ID = '0199b0c4-7f3a-7c2e-9a1b-2c3d4e5f6a7b'
const CHAT = `/api/events/${EVENT_ID}/rounds/2/chat`
const MESSAGES = `${CHAT}/messages`
const CHAT_ID = '0199b0c4-7f3a-7c2e-9a1b-2c3d4e5f6a7d'
const PARTNER_ID = '0199b0c4-7f3a-7c2e-9a1b-2c3d4e5f6a7e'
const BLOCK = `/api/accounts/${PARTNER_ID}:block`
const REPORT_1 = `${MESSAGES}/1:report`
const REPORT_3 = `${MESSAGES}/3:report`

const CLOSED = jsonAnswer({ chatId: CHAT_ID, open: false, lastSeq: 3 })
const OPEN = jsonAnswer({ chatId: CHAT_ID, open: true, lastSeq: 3 })

const REPORTED = jsonAnswer(
  {
    id: '0199b0c4-7f3a-7c2e-9a1b-2c3d4e5f6a7f',
    reportedAccountId: PARTNER_ID,
    reason: 'HARASSMENT',
    description: null,
    status: 'OPEN',
    createdAt: '2026-10-10T23:10:00Z',
  },
  201,
  { Location: '/api/reports/0199b0c4-7f3a-7c2e-9a1b-2c3d4e5f6a7f' },
)

const REASON_LABELS = [
  'Assédio ou intimidação',
  'Discurso de ódio',
  'Conteúdo sexual indesejado',
  'Violência ou ameaça',
  'Golpe ou spam',
  'Perfil falso',
  'Parece menor de idade',
  'Outro motivo',
]

function message(seq: number, text: string, fromMe = false) {
  return { seq, fromMe, text, sentAt: '2026-10-10T23:05:00Z' }
}

const THREE_MESSAGES = jsonAnswer({
  items: [message(1, 'Oi! Me passa seu endereço?'), message(2, 'Prefiro não.', true), message(3, 'Por quê?')],
  nextAfterSeq: null,
})

function retryAfter(status: number, seconds: number): FakeRoute {
  return () => Promise.resolve(new Response(null, { status, headers: { 'Retry-After': String(seconds) } }))
}

beforeEach(() => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
})

/** Chat fechado, que só lê: o polling para depois da leitura, e quem bloqueou ainda pode denunciar. */
async function renderClosedChat(routes: Readonly<Record<string, FakeRoute>> = {}) {
  const fetchMock = stubApi({
    [CHAT]: CLOSED,
    [`${MESSAGES}?afterSeq=0&maxPageSize=100`]: THREE_MESSAGES,
    ...routes,
  })
  render(<RoundChatPanel eventId={EVENT_ID} roundNumber={2} />)
  await screen.findByText('Por quê?')
  return { fetchMock, user: userEvent.setup() }
}

function reportButton(excerpt: string) {
  return screen.getByRole('button', { name: `Denunciar a mensagem “${excerpt}”` })
}

function form() {
  return screen.getByRole('region', { name: 'Denunciar mensagem' })
}

function description() {
  return screen.getByRole('textbox', { name: /Descrição/ })
}

function submitButton() {
  return within(form()).getByRole('button', { name: /^Enviar denúncia/ })
}

function postsTo(fetchMock: ReturnType<typeof stubApi>, path: string) {
  return fetchMock.mock.calls.filter(([url, init]) => String(url) === path && init?.method === 'POST')
}

/** A linha inteira da opção é o alvo (o rótulo marca a opção); o círculo e a caixa ficam no tamanho nativo. */
function isChoice(html: string): boolean {
  return /type="(radio|checkbox)"/.test(html)
}

async function openFormFor(user: ReturnType<typeof userEvent.setup>, excerpt = 'Oi! Me passa seu endereço?') {
  await user.click(reportButton(excerpt))
}

async function reportAndBlock(block: FakeRoute) {
  const rendered = await renderClosedChat({ [REPORT_1]: REPORTED, [BLOCK]: block })
  await openFormFor(rendered.user)
  await rendered.user.click(screen.getByRole('radio', { name: 'Assédio ou intimidação' }))
  await rendered.user.click(screen.getByRole('checkbox', { name: 'Também bloquear esta pessoa' }))
  await rendered.user.click(submitButton())
  return rendered
}

async function sendWith(answer: FakeRoute) {
  const rendered = await renderClosedChat({ [REPORT_1]: answer })
  await openFormFor(rendered.user)
  await rendered.user.click(screen.getByRole('radio', { name: 'Assédio ou intimidação' }))
  await rendered.user.type(description(), 'Insistiu.')
  await rendered.user.click(submitButton())
  return rendered
}

describe('reporting a chat message', () => {
  describe('the action', () => {
    it('is offered on each message of the partner, naming the message', async () => {
      await renderClosedChat()

      expect(reportButton('Oi! Me passa seu endereço?')).toBeInTheDocument()
      expect(reportButton('Por quê?')).toBeInTheDocument()
    })

    it('is never offered on your own message', async () => {
      await renderClosedChat()

      const own = screen.getByText('Prefiro não.').closest('li')
      expect(own).not.toBeNull()
      expect(within(own as HTMLElement).queryByRole('button')).not.toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /^Denunciar/ })).toHaveLength(2)
    })

    it('is also offered while the chat is open', async () => {
      stubApi({
        [CHAT]: OPEN,
        [`${MESSAGES}?afterSeq=0&maxPageSize=100`]: THREE_MESSAGES,
        [`${MESSAGES}?afterSeq=3&maxPageSize=100`]: jsonAnswer({ items: [], nextAfterSeq: null }),
      })
      render(<RoundChatPanel eventId={EVENT_ID} roundNumber={2} />)

      expect(await screen.findByRole('button', { name: 'Denunciar a mensagem “Por quê?”' })).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: 'Sua mensagem' })).toBeInTheDocument()
    })
  })

  describe('the form', () => {
    it('opens with the focus on its heading, showing the message and what a report does', async () => {
      const { user } = await renderClosedChat()

      await openFormFor(user)

      expect(screen.getByRole('heading', { name: 'Denunciar mensagem' })).toHaveFocus()
      expect(within(form()).getByText('Oi! Me passa seu endereço?')).toBeInTheDocument()
      expect(within(form()).getByText(/Uma cópia desta mensagem vai para a moderação do Duora/)).toBeInTheDocument()
      expect(within(form()).getByText(/Denunciar não bloqueia a pessoa/)).toBeInTheDocument()
    })

    it('lists the reasons in Portuguese, each with a short explanation', async () => {
      const { user } = await renderClosedChat()
      await openFormFor(user)

      const radios = within(screen.getByRole('radiogroup', { name: 'Motivo' })).getAllByRole('radio')

      expect(radios).toEqual(REASON_LABELS.map((name) => screen.getByRole('radio', { name })))
      expect(screen.getByRole('radio', { name: 'Parece menor de idade' })).toHaveAccessibleDescription(
        'O Duora é só para maiores de 18 anos.',
      )
      for (const radio of radios) {
        expect(radio).not.toBeChecked()
        expect(radio).not.toHaveAccessibleDescription('')
      }
    })

    it('closes on cancel and gives the focus back to the action of the message', async () => {
      const { fetchMock, user } = await renderClosedChat()
      await openFormFor(user, 'Por quê?')

      await user.click(within(form()).getByRole('button', { name: 'Cancelar' }))

      expect(screen.queryByRole('region', { name: 'Denunciar mensagem' })).not.toBeInTheDocument()
      expect(reportButton('Por quê?')).toHaveFocus()
      expect(postsTo(fetchMock, REPORT_3)).toHaveLength(0)
    })

    it('asks for a reason before sending, with the focus on the reasons', async () => {
      const { fetchMock, user } = await renderClosedChat()
      await openFormFor(user)

      await user.click(submitButton())

      expect(screen.getByRole('radiogroup', { name: 'Motivo' })).toHaveAccessibleDescription('Escolha um motivo.')
      expect(screen.getByRole('radio', { name: 'Assédio ou intimidação' })).toHaveFocus()
      expect(postsTo(fetchMock, REPORT_1)).toHaveLength(0)
    })

    it('makes the description optional for a listed reason', async () => {
      const { user } = await renderClosedChat()
      await openFormFor(user)

      await user.click(screen.getByRole('radio', { name: 'Golpe ou spam' }))

      expect(description()).not.toBeRequired()
      expect(description()).toHaveAccessibleDescription('Opcional. 0 de 1000 caracteres.')
    })

    it('asks for a description with "Outro motivo", with the focus on the field', async () => {
      const { fetchMock, user } = await renderClosedChat()
      await openFormFor(user)

      await user.click(screen.getByRole('radio', { name: 'Outro motivo' }))
      expect(description()).toBeRequired()
      await user.type(description(), '   ')
      await user.click(submitButton())

      expect(description()).toHaveFocus()
      expect(description()).toBeInvalid()
      expect(description()).toHaveAccessibleDescription(
        'Conte o que aconteceu: com “Outro motivo”, a descrição é obrigatória. Obrigatória. 0 de 1000 caracteres.',
      )
      expect(postsTo(fetchMock, REPORT_1)).toHaveLength(0)
    })

    it('counts the description in characters, the way the API counts', async () => {
      const { user } = await renderClosedChat()
      await openFormFor(user)

      await user.type(description(), ' 😀👩‍💻 ')

      expect(screen.getByText('Opcional. 4 de 1000 caracteres.')).toBeInTheDocument()
    })

    it('refuses a description over the limit without sending it', async () => {
      const { fetchMock, user } = await renderClosedChat()
      await openFormFor(user)
      await user.click(screen.getByRole('radio', { name: 'Assédio ou intimidação' }))

      fireEvent.change(description(), { target: { value: 'a'.repeat(1001) } })
      expect(screen.getByText('Opcional. 1001 de 1000 caracteres.')).toHaveClass('text-danger')
      await user.click(submitButton())

      expect(description()).toHaveFocus()
      expect(description()).toHaveAccessibleDescription(
        'A descrição passou de 1000 caracteres. Encurte para enviar. Opcional. 1001 de 1000 caracteres.',
      )
      expect(postsTo(fetchMock, REPORT_1)).toHaveLength(0)
    })

    it('offers to block the person too, unchecked, and says so on the button when checked', async () => {
      const { user } = await renderClosedChat()
      await openFormFor(user)
      const block = screen.getByRole('checkbox', { name: 'Também bloquear esta pessoa' })

      expect(block).not.toBeChecked()
      expect(block).toHaveAccessibleDescription(/Vocês não poderão mais conversar/)
      await user.click(block)

      expect(submitButton()).toHaveAccessibleName('Enviar denúncia e bloquear')
    })

    it('gives every control the 44px touch target', async () => {
      const { user } = await renderClosedChat()
      await openFormFor(user)

      expect(elementsWithoutTouchTarget(document.body).filter((html) => !isChoice(html))).toEqual([])
      for (const choice of [...screen.getAllByRole('radio'), screen.getByRole('checkbox')]) {
        expect(choice.closest('label')).toHaveClass('min-h-11')
      }
    })
  })

  describe('sending', () => {
    it('posts the reason and the description, then confirms with the focus on the confirmation', async () => {
      const { fetchMock, user } = await renderClosedChat({ [REPORT_1]: REPORTED })
      await openFormFor(user)

      await user.click(screen.getByRole('radio', { name: 'Outro motivo' }))
      await user.type(description(), ' Pediu meu endereço. ')
      await user.click(submitButton())

      const confirmation = await screen.findByRole('status')
      expect(confirmation).toHaveTextContent('Denúncia enviada. A moderação do Duora vai analisar a mensagem.')
      expect(confirmation).toHaveFocus()
      const [[, init] = []] = postsTo(fetchMock, REPORT_1)
      expect(JSON.parse(String(init?.body))).toEqual({ reason: 'OTHER', description: 'Pediu meu endereço.' })
      expect(screen.queryByRole('region', { name: 'Denunciar mensagem' })).not.toBeInTheDocument()
    })

    it('marks the reported message for you, and only it, without offering to report it again', async () => {
      const { user } = await renderClosedChat({ [REPORT_1]: REPORTED })
      await openFormFor(user)
      await user.click(screen.getByRole('radio', { name: 'Assédio ou intimidação' }))
      await user.click(submitButton())
      await screen.findByRole('status')

      const reported = screen.getByText('Oi! Me passa seu endereço?').closest('li') as HTMLElement
      expect(within(reported).getByText('Denunciada por você')).toBeInTheDocument()
      expect(within(reported).queryByRole('button')).not.toBeInTheDocument()
      expect(screen.getAllByText('Denunciada por você')).toHaveLength(1)
      expect(reportButton('Por quê?')).toBeInTheDocument()
    })

    it('shows that it is sending and does not send twice', async () => {
      let release: (() => void) | undefined
      const held: FakeRoute = (init) =>
        new Promise((resolve) => {
          release = () => void REPORTED(init).then(resolve)
        })
      const { fetchMock, user } = await renderClosedChat({ [REPORT_1]: held })
      await openFormFor(user)
      await user.click(screen.getByRole('radio', { name: 'Assédio ou intimidação' }))

      await user.click(submitButton())
      expect(within(form()).getByRole('button', { name: 'Enviando…' })).toBeDisabled()
      await user.click(within(form()).getByRole('button', { name: 'Enviando…' }))
      release?.()

      expect(await screen.findByRole('status')).toBeInTheDocument()
      expect(postsTo(fetchMock, REPORT_1)).toHaveLength(1)
    })

    it('does not block when the person did not ask to', async () => {
      const { fetchMock, user } = await renderClosedChat({ [REPORT_1]: REPORTED })
      await openFormFor(user)
      await user.click(screen.getByRole('radio', { name: 'Assédio ou intimidação' }))
      await user.click(submitButton())

      expect(await screen.findByRole('status')).not.toHaveTextContent(/bloque/)
      expect(postsTo(fetchMock, BLOCK)).toHaveLength(0)
    })
  })

  describe('blocking too', () => {

    it('blocks the reported account after the report, and says so', async () => {
      const { fetchMock } = await reportAndBlock(byMethod({ POST: statusAnswer(204) }))

      const confirmation = await screen.findByRole('status')
      expect(confirmation).toHaveTextContent('Você também bloqueou esta pessoa.')
      expect(within(confirmation).getByRole('link', { name: 'Contas bloqueadas' })).toHaveAttribute(
        'href',
        '/perfil/bloqueios',
      )
      expect(postsTo(fetchMock, BLOCK)).toHaveLength(1)
      const order = fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url === REPORT_1 || url === BLOCK)
      expect(order).toEqual([REPORT_1, BLOCK])
    })

    it('keeps the report when the block fails, says so, and lets the person try the block again', async () => {
      const { fetchMock, user } = await reportAndBlock(byMethod({ POST: inSequence(problemAnswer(500), statusAnswer(204)) }))

      expect(await screen.findByRole('status')).toHaveTextContent('Denúncia enviada.')
      expect(screen.getByRole('alert')).toHaveTextContent('A denúncia está feita, mas o bloqueio não deu certo.')
      expect(screen.getByText('Oi! Me passa seu endereço?').closest('li')).toHaveTextContent('Denunciada por você')
      await user.click(screen.getByRole('button', { name: 'Tentar bloquear de novo' }))

      expect(await screen.findByText('Você também bloqueou esta pessoa.', { exact: false })).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(postsTo(fetchMock, BLOCK)).toHaveLength(2)
      expect(postsTo(fetchMock, REPORT_1)).toHaveLength(1)
    })

    it('says again that the block failed when the new try fails too', async () => {
      const { user } = await reportAndBlock(byMethod({ POST: networkFailure() }))
      const first = await screen.findByRole('alert')

      await user.click(screen.getByRole('button', { name: 'Tentar bloquear de novo' }))

      const second = await screen.findByRole('alert')
      expect(second).not.toBe(first)
      expect(second).toHaveTextContent('A denúncia está feita, mas o bloqueio não deu certo.')
    })

    it('asks to sign in again when the session ended before the block, keeping the report', async () => {
      await reportAndBlock(byMethod({ POST: statusAnswer(401) }))

      expect(await screen.findByRole('status')).toHaveTextContent('Denúncia enviada.')
      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent('A denúncia está feita, mas sua sessão terminou antes do bloqueio.')
      expect(within(alert).getByRole('link', { name: 'Entrar de novo' })).toHaveAttribute('href', LOGIN_URL)
    })

    it('does not block when the report fails', async () => {
      const { fetchMock } = await renderClosedChat({ [REPORT_1]: problemAnswer(500), [BLOCK]: statusAnswer(204) })
      const user = userEvent.setup()
      await openFormFor(user)
      await user.click(screen.getByRole('radio', { name: 'Assédio ou intimidação' }))
      await user.click(screen.getByRole('checkbox', { name: 'Também bloquear esta pessoa' }))
      await user.click(submitButton())

      expect(await screen.findByRole('alert')).toBeInTheDocument()
      expect(postsTo(fetchMock, BLOCK)).toHaveLength(0)
    })
  })

  describe('refusals', () => {

    it('shows a 400 on the description next to the field, with the focus on it', async () => {
      await sendWith(problemAnswer(400, 'invalid', [{ field: 'description', code: 'FORBIDDEN_CHARACTER' }]))

      await vi.waitFor(() => expect(description()).toHaveFocus())
      expect(description()).toHaveAccessibleDescription(
        'A descrição tem um caractere que não é aceito. Tire-o e envie de novo. Opcional. 9 de 1000 caracteres.',
      )
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('shows a 400 on the reason next to the reasons', async () => {
      await sendWith(problemAnswer(400, 'invalid', [{ field: 'reason', code: 'UNSUPPORTED_VALUE' }]))

      await vi.waitFor(() =>
        expect(screen.getByRole('radiogroup', { name: 'Motivo' })).toHaveAccessibleDescription(
          'Este motivo não foi aceito. Escolha outro.',
        ),
      )
    })

    it.each([
      [
        'a 400 without a field of the form',
        problemAnswer(400, 'invalid', [{ field: null, code: 'MALFORMED_BODY' }]),
        'A denúncia não foi aceita. Revise e envie de novo.',
      ],
      [
        '404',
        problemAnswer(404),
        'Não encontramos esta mensagem. Ela pode ter sido apagada com a conversa.',
      ],
      [
        '429, with the time of the Retry-After',
        retryAfter(429, 7200),
        'Você atingiu o limite de denúncias de hoje. Você poderá denunciar de novo em 2 horas.',
      ],
      ['429 without Retry-After', statusAnswer(429), 'Você atingiu o limite de denúncias de hoje. Você poderá denunciar de novo mais tarde.'],
      ['503', retryAfter(503, 1), 'As denúncias estão indisponíveis agora. Tente de novo em instantes.'],
      ['a network failure', networkFailure(), 'Não foi possível enviar a denúncia. Tente de novo.'],
      ['500', problemAnswer(500), 'Não foi possível enviar a denúncia. Tente de novo.'],
    ])('announces %s as an alert and keeps the form', async (_case, answer, text) => {
      await sendWith(answer)

      expect(await screen.findByRole('alert')).toHaveTextContent(text)
      expect(description()).toHaveValue('Insistiu.')
      expect(submitButton()).toBeEnabled()
      expect(screen.queryByText('Denunciada por você')).not.toBeInTheDocument()
    })

    it('asks to sign in again on 401', async () => {
      await sendWith(statusAnswer(401))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Sua sessão terminou. Entre de novo para denunciar.')
      expect(within(alert).getByRole('link', { name: 'Entrar de novo' })).toHaveAttribute('href', LOGIN_URL)
    })

    it('clears the alert when the person sends again', async () => {
      const { user } = await sendWith(inSequence(problemAnswer(500), REPORTED))
      await screen.findByRole('alert')

      await user.click(submitButton())

      expect(await screen.findByRole('status')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
