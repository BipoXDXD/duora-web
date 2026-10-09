import { describe, expect, it } from 'vitest'
import { adminEventPath, eventPath, isEventsRoute, isProfileRoute, isStaffRoute, PATHS, routeOf } from './routes.ts'

const EVENT_ID = '0199b0c4-7f3a-7c2e-9a1b-2c3d4e5f6a7b'

describe('routeOf', () => {
  it.each([
    ['/', 'home'],
    ['/perfil', 'profile'],
    ['/perfil/', 'profile'],
    ['/perfil/bloqueios', 'blockedAccounts'],
    ['/perfil/bloqueios/', 'blockedAccounts'],
    ['/eventos', 'events'],
    ['/eventos/', 'events'],
    ['/inscricoes', 'registrations'],
    ['/conexoes', 'connections'],
    ['/conexoes/', 'connections'],
    ['/admin/eventos', 'adminEvents'],
    ['/admin/eventos/', 'adminEvents'],
    ['/admin/eventos/novo', 'adminNewEvent'],
    ['/admin/eventos/novo/', 'adminNewEvent'],
  ] as const)('maps %s to the %s page', (pathname, page) => {
    expect(routeOf(pathname)).toEqual({ page })
  })

  it.each([
    [`/eventos/${EVENT_ID}`, EVENT_ID],
    [`/eventos/${EVENT_ID}/`, EVENT_ID],
    [`/eventos/${EVENT_ID.toUpperCase()}`, EVENT_ID],
  ])('maps %s to the page of the event, with its id in lower case', (pathname, eventId) => {
    expect(routeOf(pathname)).toEqual({ page: 'event', eventId })
  })

  it.each([
    [`/admin/eventos/${EVENT_ID}`, EVENT_ID],
    [`/admin/eventos/${EVENT_ID}/`, EVENT_ID],
    [`/admin/eventos/${EVENT_ID.toUpperCase()}`, EVENT_ID],
  ])('maps %s to the admin page of the event, with its id in lower case', (pathname, eventId) => {
    expect(routeOf(pathname)).toEqual({ page: 'adminEvent', eventId })
  })

  it.each([
    '/admin',
    '/Admin/eventos',
    '/admin/eventos/123',
    '/admin/eventos/Novo',
    '/admin/eventos/novo/outra',
    `/admin/eventos/${EVENT_ID}x`,
    `/admin/eventos/${EVENT_ID}/rodadas`,
    `/admin/eventos//${EVENT_ID}`,
    `/Admin/eventos/${EVENT_ID}`,
  ])('maps the unknown admin path %s to the not found page', (pathname) => {
    expect(routeOf(pathname)).toEqual({ page: 'notFound' })
  })

  it.each([
    '/perfil/outra',
    '/Perfil',
    '/bloqueios',
    '/perfil//bloqueios',
    '/index.html',
    '/conexoes/outra',
    '/eventos/123',
    `/eventos/${EVENT_ID}x`,
    `/eventos/${EVENT_ID.slice(1)}`,
    `/eventos/${EVENT_ID}/rodadas`,
    `/eventos//${EVENT_ID}`,
    `/x/eventos/${EVENT_ID}`,
    `/Eventos/${EVENT_ID}`,
  ])('maps the unknown path %s to the not found page', (pathname) => {
    expect(routeOf(pathname)).toEqual({ page: 'notFound' })
  })

  it('maps every declared path back to its own route', () => {
    for (const [page, path] of Object.entries(PATHS)) {
      expect(routeOf(path)).toEqual({ page })
    }
  })

  it('maps the path of an event back to the event', () => {
    expect(routeOf(eventPath(EVENT_ID))).toEqual({ page: 'event', eventId: EVENT_ID })
  })

  it('maps the admin path of an event back to the event', () => {
    expect(routeOf(adminEventPath(EVENT_ID))).toEqual({ page: 'adminEvent', eventId: EVENT_ID })
  })
})

describe('route groups for the navigation', () => {
  it.each([
    [{ page: 'profile' }, true, false, false],
    [{ page: 'blockedAccounts' }, true, false, false],
    [{ page: 'events' }, false, true, false],
    [{ page: 'event', eventId: EVENT_ID }, false, true, false],
    [{ page: 'registrations' }, false, true, false],
    [{ page: 'home' }, false, false, false],
    [{ page: 'adminEvents' }, false, false, true],
    [{ page: 'adminNewEvent' }, false, false, true],
    [{ page: 'adminEvent', eventId: EVENT_ID }, false, false, true],
    [{ page: 'notFound' }, false, false, false],
  ] as const)('places %o in the profile: %s, in the events: %s, in the staff area: %s', (route, inProfile, inEvents, inStaff) => {
    expect(isProfileRoute(route)).toBe(inProfile)
    expect(isEventsRoute(route)).toBe(inEvents)
    expect(isStaffRoute(route)).toBe(inStaff)
  })
})
