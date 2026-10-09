import { EventPage } from './pages/EventPage.ts'
import { expectUsableChatLayout } from './support/checks.ts'
import { anEventInProgress } from './support/data.ts'
import { problem } from './support/fakeApi.ts'
import { expect, test } from './support/fixtures.ts'
import { DECISION_PATH, OngoingRound } from './support/ongoingRound.ts'

const EVENT_TITLE = anEventInProgress().title

test.describe('Decisão privada depois da rodada', () => {
  test('confirmar "Quero continuar em contato" registra a decisão, que continua depois de recarregar', async ({
    page,
    api,
  }) => {
    OngoingRound.declare(api)
    const event = await new EventPage(page).open(EVENT_TITLE)
    const { decision } = event.pairing
    await expect(decision.wantButton()).toBeVisible()
    await expect(decision.declineButton()).toBeVisible()
    await expectUsableChatLayout(page)

    // Escolher não grava: a decisão é final, então há um passo de confirmação.
    await decision.wantButton().click()
    await expect(decision.chosen('quero continuar em contato')).toBeVisible()
    await expect(decision.confirmButton()).toBeFocused()
    expect(api.hasCalled('PUT', DECISION_PATH)).toBe(false)

    await decision.confirmButton().click()

    await expect(decision.notice('Decisão registrada.')).toBeFocused()
    await expect(decision.recorded('Sua decisão: você quer continuar em contato.')).toBeVisible()
    await expect(decision.wantButton()).toBeHidden()
    expect(api.callsTo('PUT', DECISION_PATH).map((call) => call.body)).toEqual([{ interested: true }])
    await expectUsableChatLayout(page)

    // A decisão vem do servidor (GET), não do estado da tela.
    await event.reload(EVENT_TITLE)
    await expect(decision.recorded('Sua decisão: você quer continuar em contato.')).toBeVisible()
    await expect(decision.wantButton()).toBeHidden()
    expect(api.callsTo('PUT', DECISION_PATH)).toHaveLength(1)
    await expectUsableChatLayout(page)
  })

  test('decisão já tomada em outra aba (409) mostra a que vale e não deixa mudar', async ({ page, api }) => {
    const round = OngoingRound.declare(api)
    const { decision } = (await new EventPage(page).open(EVENT_TITLE)).pairing
    await expect(decision.wantButton()).toBeVisible()
    // Em outra aba a pessoa já tinha decidido que não quer; a API recusa a mudança.
    round.storeDecision(false)
    api.on('PUT', DECISION_PATH, problem(409, { reason: 'DECISION_ALREADY_MADE' }))

    await decision.decideToStayInTouch()

    await expect(decision.recorded('Você já tinha decidido nesta rodada, e a decisão é final. Esta é a que vale.')).toBeVisible()
    await expect(decision.recorded('Sua decisão: você não quer continuar em contato.')).toBeVisible()
  })
})
