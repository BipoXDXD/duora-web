import { describe, expect, it } from 'vitest'
import { PATHS, routeOf } from './routes.ts'

describe('routeOf', () => {
  it.each([
    ['/', 'home'],
    ['/perfil', 'profile'],
    ['/perfil/', 'profile'],
    ['/perfil/bloqueios', 'blockedAccounts'],
    ['/perfil/bloqueios/', 'blockedAccounts'],
  ] as const)('maps %s to the %s page', (pathname, route) => {
    expect(routeOf(pathname)).toBe(route)
  })

  it.each(['/perfil/outra', '/Perfil', '/bloqueios', '/perfil//bloqueios', '/index.html'])(
    'maps the unknown path %s to the not found page',
    (pathname) => {
      expect(routeOf(pathname)).toBe('notFound')
    },
  )

  it('maps every declared path back to its own route', () => {
    for (const [route, path] of Object.entries(PATHS)) {
      expect(routeOf(path)).toBe(route)
    }
  })
})
