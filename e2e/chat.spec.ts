import { EventPage } from './pages/EventPage.ts'
import { expectUsableChatLayout } from './support/checks.ts'
import { aMessage, anEventInProgress, PARTNER_CODE } from './support/data.ts'
import { gate, json } from './support/fakeApi.ts'
import { expect, test } from './support/fixtures.ts'
import { CHAT_PATH, OngoingRound } from './support/ongoingRound.ts'

const EVENT_TITLE = anEventInProgress().title
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

test.describe('Conversa com a dupla da rodada', () => {
  test('mostra a dupla, traz a mensagem nova do par pelo polling e confirma a que a pessoa envia', async ({
    page,
    api,
  }) => {
    const round = OngoingRound.declare(api, [aMessage(1, false, 'Oi! Você está na mesa do canto?')])
    const event = await new EventPage(page).open(EVENT_TITLE)
    const { pairing } = event
    const { chat } = pairing

    // A dupla da rodada atual.
    await expect(event.phase('Em andamento')).toBeVisible()
    await expect(pairing.currentRound(1)).toBeVisible()
    await expect(pairing.partner(1, PARTNER_CODE)).toBeVisible()
    await expect(chat.message('Você está na mesa do canto?')).toBeVisible()
    await expect(chat.log()).toHaveAttribute('aria-live', 'polite')
    await expectUsableChatLayout(page)

    // O par escreve; a tela só sabe quando o polling (a cada 2 s) lê a partir do último `seq` que viu.
    round.partnerSays('Estou de camiseta verde, perto da janela.')
    await expect(chat.message('camiseta verde')).toBeVisible({ timeout: 10_000 })
    expect(api.callsTo('GET', `${CHAT_PATH}/messages`).map((call) => call.query.get('afterSeq'))).toContain('1')

    // A mensagem própria fica pendente até a API confirmar.
    const confirmation = gate()
    api.on('POST', `${CHAT_PATH}/messages`, () => confirmation.answer)
    await chat.send('Já vi você, estou indo.')

    await expect(chat.message('Já vi você, estou indo.')).toBeVisible()
    await expect(chat.sending()).toBeVisible()
    await expect(chat.field()).toHaveValue('')
    await expect(chat.field()).toBeFocused()
    await expectUsableChatLayout(page)

    confirmation.release(json(201, round.accept('Já vi você, estou indo.')))

    await expect(chat.sending()).toBeHidden()
    await expect(chat.message('Já vi você, estou indo.').locator('time')).toBeVisible()
    const [sent] = api.callsTo('POST', `${CHAT_PATH}/messages`)
    expect(sent?.body).toEqual({ text: 'Já vi você, estou indo.' })
    expect(sent?.headers['idempotency-key']).toMatch(UUID)
    await expectUsableChatLayout(page)
  })

  test('mensagem que a API recusa fica marcada como não enviada e pode ser reenviada', async ({ page, api }) => {
    const round = OngoingRound.declare(api)
    api.on('POST', `${CHAT_PATH}/messages`, { status: 500 })
    const { chat } = (await new EventPage(page).open(EVENT_TITLE)).pairing

    await chat.send('Chego em cinco minutos')

    await expect(chat.message('Chego em cinco minutos')).toContainText('Não foi enviada.')
    api.on('POST', `${CHAT_PATH}/messages`, (request) => round.acceptSent(request))
    await chat.message('Chego em cinco minutos').getByRole('button', { name: 'Tentar enviar de novo' }).click()

    await expect(chat.message('Chego em cinco minutos').locator('time')).toBeVisible()
    await expect(chat.message('Chego em cinco minutos')).not.toContainText('Não foi enviada.')
    const [first, second] = api.callsTo('POST', `${CHAT_PATH}/messages`)
    // Reenviar usa a mesma chave de idempotência: a API não grava duas vezes.
    expect(second?.headers['idempotency-key']).toBe(first?.headers['idempotency-key'])
  })
})
