import { describe, expect, it } from 'vitest'
import { eventPath, isEventsRoute, isProfileRoute, PATHS, routeOf } from './routes.ts'

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
    '/perfil/outra',
    '/Perfil',
    '/bloqueios',
    '/perfil//bloqueios',
    '/index.html',
    '/eventos/123',
    `/eventos/${EVENT_ID}x`,
    `/eventos/${EVENT_ID.slice(1)}`,
    `/eventos/${EVENT_ID}/rodadas`,
    `/eventos//${EVENT_ID}`,
    `/x/eventos/${EVENT_ID}`,
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
})

describe('route groups for the navigation', () => {
  it.each([
    [{ page: 'profile' }, true, false],
    [{ page: 'blockedAccounts' }, true, false],
    [{ page: 'events' }, false, true],
    [{ page: 'event', eventId: EVENT_ID }, false, true],
    [{ page: 'registrations' }, false, false],
    [{ page: 'home' }, false, false],
    [{ page: 'notFound' }, false, false],
  ] as const)('places %o in the profile: %s, in the events: %s', (route, inProfile, inEvents) => {
    expect(isProfileRoute(route)).toBe(inProfile)
    expect(isEventsRoute(route)).toBe(inEvents)
  })
})
