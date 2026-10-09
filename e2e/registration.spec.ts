import { EventPage } from './pages/EventPage.ts'
import { expectUsableLayout } from './support/checks.ts'
import { aRegistration, aSession, anUpcomingEvent, EVENT_ID } from './support/data.ts'
import { json, problem } from './support/fakeApi.ts'
import { expect, test } from './support/fixtures.ts'

const EVENT = anUpcomingEvent()
const REGISTRATION_PATH = `/api/events/${EVENT_ID}/registration`

test.beforeEach(({ api }) => {
  api
    .on('GET', '/api/me', json(200, aSession()))
    .on('GET', `/api/events/${EVENT_ID}`, json(200, EVENT))
    .on('GET', REGISTRATION_PATH, problem(404))
})

test.describe('Inscrição num evento', () => {
  test('quem está logado abre o evento, se inscreve e vê a confirmação', async ({ page, api }) => {
    api.on('PUT', REGISTRATION_PATH, json(201, aRegistration()))
    const event = await new EventPage(page).open(EVENT.title)
    await expect(event.registration.registerButton()).toBeVisible()
    await expectUsableLayout(page)

    await event.registration.register()

    // O botão usado some; por isso a confirmação recebe o foco (o leitor de tela a anuncia).
    await expect(event.registration.success('Inscrição feita. Até lá!')).toBeFocused()
    await expect(event.registration.onTheList()).toBeVisible()
    await expect(event.registration.cancelButton()).toBeVisible()
    expect(api.callsTo('PUT', REGISTRATION_PATH)).toHaveLength(1)
    await expectUsableLayout(page)
  })

  test('evento lotado (409 EVENT_FULL) explica o motivo e mantém a inscrição aberta a nova tentativa', async ({
    page,
    api,
  }) => {
    api.on('PUT', REGISTRATION_PATH, problem(409, { reason: 'EVENT_FULL' }))
    const event = await new EventPage(page).open(EVENT.title)

    await event.registration.register()

    const reason = event.registration.failure('O evento lotou, então não dá mais para se inscrever.')
    await expect(reason).toBeVisible()
    await expect(event.registration.onTheList()).toBeHidden()
    await expect(event.registration.registerButton()).toBeEnabled()
    await expectUsableLayout(page)
  })
})
