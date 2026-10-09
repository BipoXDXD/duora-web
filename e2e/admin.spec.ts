import { z } from 'zod/mini'
import { AdminEventsPage } from './pages/AdminEventsPage.ts'
import { AdminServer, ADMIN_EVENTS_PATH } from './support/adminServer.ts'
import { expectUsableLayout } from './support/checks.ts'
import { aSession, anAdminEvent } from './support/data.ts'
import { json, problem } from './support/fakeApi.ts'
import { expect, test } from './support/fixtures.ts'

const BRASILIA_OFFSET = '-03:00'
const HOUR_MS = 3_600_000

/** O instante daqui a `hoursAhead` horas como o `<input type="datetime-local">` o entrega, no fuso do teste. */
function localInputValue(hoursAhead: number): string {
  const instant = new Date(Date.now() + hoursAhead * HOUR_MS)
  return instant.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T').slice(0, 16)
}

test.describe('Área da equipe', () => {
  test('ADMIN vê os eventos, cria um rascunho e o publica', async ({ page, api }) => {
    api.on('GET', '/api/me', json(200, aSession({ displayName: 'Bia Admin', roles: ['ADMIN'] })))
    const server = new AdminServer(api, [anAdminEvent({ title: 'Noite de jogos' })])
    const events = await new AdminEventsPage(page).open()
    await expect(events.eventLink('Noite de jogos')).toBeVisible()
    await expect(events.events()).toContainText('12 pessoas inscritas de 40 vagas.')
    await expectUsableLayout(page)

    const form = await events.startNewEvent()
    await form.submitButton().click()
    await expect(form.problem('Dê um título ao evento.')).toBeVisible()
    expect(api.hasCalled('POST', ADMIN_EVENTS_PATH)).toBe(false)

    const startsAt = localInputValue(48)
    const endsAt = localInputValue(51)
    const draft = await form.create({
      title: 'Degustação de vinhos',
      description: 'Uma noite de vinhos e cartas.',
      startsAt,
      endsAt,
      capacity: '30',
    })

    // O rascunho nasce fechado: só a equipe o vê até a publicação.
    await expect(draft.phase('Rascunho')).toBeVisible()
    const [created] = api.callsTo('POST', ADMIN_EVENTS_PATH)
    expect(created?.body).toEqual({
      title: 'Degustação de vinhos',
      description: 'Uma noite de vinhos e cartas.',
      startsAt: expect.any(String),
      endsAt: expect.any(String),
      capacity: 30,
    })
    // O horário vai com o fuso de quem criou: o mesmo instante que a pessoa digitou.
    expect(Date.parse(z.object({ startsAt: z.string() }).parse(created?.body).startsAt)).toBe(Date.parse(`${startsAt}:00${BRASILIA_OFFSET}`))
    await expectUsableLayout(page)

    await draft.publish()

    await expect(draft.notice('Evento publicado.')).toBeVisible()
    await expect(draft.phase('Publicado')).toBeVisible()
    expect(server.events.map((event) => [event.title, event.status])).toEqual([
      ['Noite de jogos', 'PUBLISHED'],
      ['Degustação de vinhos', 'PUBLISHED'],
    ])
    await expectUsableLayout(page)
  })

  test('quem não tem o papel ADMIN recebe 403 da API e só vê o aviso de área restrita', async ({ page, api }) => {
    api
      .on('GET', '/api/me', json(200, aSession()))
      .on('GET', ADMIN_EVENTS_PATH, problem(403))
    const events = await new AdminEventsPage(page).openWithoutRole()

    await expect(events.staffOnly()).toBeVisible()
    await expect(events.newEventLink()).toHaveCount(0)
    await expectUsableLayout(page)
  })
})
