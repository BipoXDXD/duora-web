import type { ChatMessageReportResponse } from '../src/shared/api/contract.ts'
import { EventPage } from './pages/EventPage.ts'
import { expectUsableLayout } from './support/checks.ts'
import { aMessage, anEventInProgress, PARTNER_ID } from './support/data.ts'
import { json, noContent, problem } from './support/fakeApi.ts'
import { expect, test } from './support/fixtures.ts'
import { CHAT_PATH, OngoingRound } from './support/ongoingRound.ts'

const EVENT_TITLE = anEventInProgress().title
const PARTNER_TEXT = 'Me passa seu telefone agora?'
const OWN_TEXT = 'Prefiro não passar.'
const REPORT_PATH = `${CHAT_PATH}/messages/1:report`
const BLOCK_PATH = `/api/accounts/${PARTNER_ID}:block`

const FILED_REPORT: ChatMessageReportResponse = {
  id: '0199b0c4-7f3a-7c2e-9a1b-0000000000e1',
  status: 'OPEN',
  reason: 'HARASSMENT',
  description: null,
  reportedAccountId: PARTNER_ID,
  createdAt: new Date().toISOString(),
}

test.beforeEach(({ api }) => {
  OngoingRound.declare(api, [aMessage(1, false, PARTNER_TEXT), aMessage(2, true, OWN_TEXT)])
  api.on('POST', REPORT_PATH, json(201, FILED_REPORT))
})

test.describe('Denúncia de mensagem da dupla', () => {
  test('denuncia a mensagem do par e bloqueia a pessoa na mesma ação', async ({ page, api }) => {
    api.on('POST', BLOCK_PATH, noContent)
    const { chat } = (await new EventPage(page).open(EVENT_TITLE)).pairing

    // Só a mensagem do par oferece a denúncia.
    await expect(chat.message(OWN_TEXT)).toBeVisible()
    await expect(chat.message(OWN_TEXT).getByRole('button', { name: /Denunciar/ })).toHaveCount(0)
    await chat.reportButtonFor(PARTNER_TEXT).click()
    await expect(chat.report.heading()).toBeFocused()
    await expectUsableLayout(page)

    // Sem motivo, nada é enviado.
    await chat.report.submitButton().click()
    await expect(chat.report.problem('Escolha um motivo.')).toBeVisible()
    expect(api.hasCalled('POST', REPORT_PATH)).toBe(false)

    await chat.report.reason('Assédio ou intimidação').check()
    await chat.report.alsoBlock().check()
    await chat.report.submitButton().click()

    await expect(chat.report.confirmation()).toContainText('Você também bloqueou esta pessoa.')
    await expect(chat.report.confirmation()).toBeFocused()
    await expect(chat.message(PARTNER_TEXT)).toContainText('Denunciada por você')
    expect(api.callsTo('POST', REPORT_PATH).map((call) => call.body)).toEqual([{ reason: 'HARASSMENT', description: null }])
    expect(api.callsTo('POST', BLOCK_PATH)).toHaveLength(1)
    await expectUsableLayout(page)
  })

  test('denunciar sem marcar o bloqueio não bloqueia ninguém', async ({ page, api }) => {
    const { chat } = (await new EventPage(page).open(EVENT_TITLE)).pairing

    await chat.reportButtonFor(PARTNER_TEXT).click()
    await chat.report.reason('Outro motivo').check()
    await chat.report.description().fill('Insistiu depois de eu dizer não.')
    await chat.report.submitButton().click()

    await expect(chat.report.confirmation()).toBeVisible()
    await expect(chat.report.confirmation()).not.toContainText('bloqueou')
    expect(api.callsTo('POST', REPORT_PATH).map((call) => call.body)).toEqual([
      { reason: 'OTHER', description: 'Insistiu depois de eu dizer não.' },
    ])
    expect(api.hasCalled('POST', BLOCK_PATH)).toBe(false)
  })

  test('se o bloqueio falha, a denúncia continua feita e dá para tentar bloquear de novo', async ({ page, api }) => {
    api.on('POST', BLOCK_PATH, problem(500))
    const { chat } = (await new EventPage(page).open(EVENT_TITLE)).pairing

    await chat.reportButtonFor(PARTNER_TEXT).click()
    await chat.report.reason('Golpe ou spam').check()
    await chat.report.alsoBlock().check()
    await chat.report.submitButton().click()

    await expect(chat.report.confirmation()).toBeVisible()
    await expect(chat.report.failureAlert('A denúncia está feita, mas o bloqueio não deu certo.')).toBeVisible()
    api.on('POST', BLOCK_PATH, noContent)
    await page.getByRole('button', { name: 'Tentar bloquear de novo' }).click()

    await expect(chat.report.confirmation()).toContainText('Você também bloqueou esta pessoa.')
    expect(api.callsTo('POST', REPORT_PATH)).toHaveLength(1)
    expect(api.callsTo('POST', BLOCK_PATH)).toHaveLength(2)
  })
})
