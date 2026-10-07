/**
 * As páginas do app e o caminho de cada uma. Um caminho só por página; a barra no fim é tolerada porque
 * o navegador a acrescenta às vezes.
 */
export const PATHS = {
  home: '/',
  profile: '/perfil',
  blockedAccounts: '/perfil/bloqueios',
  events: '/eventos',
  registrations: '/inscricoes',
} as const

type FixedPage = keyof typeof PATHS

/** A página aberta. Só a do evento tem parâmetro: o id, sempre em minúsculas. */
export type Route =
  | { readonly page: FixedPage }
  | { readonly page: 'event'; readonly eventId: string }
  | { readonly page: 'notFound' }

/** Toda página de PATHS; o teste confere que nenhuma ficou de fora. */
const FIXED_PAGES: readonly FixedPage[] = ['home', 'profile', 'blockedAccounts', 'events', 'registrations']

const TRAILING_SLASH = /(?<=.)\/$/

/** `/eventos/{id}`, com o id no formato UUID que a API usa; outro texto no lugar do id é página inexistente. */
const EVENT_PATH = /^\/eventos\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

export function routeOf(pathname: string): Route {
  const path = pathname.replace(TRAILING_SLASH, '')
  const fixedPage = FIXED_PAGES.find((page) => PATHS[page] === path)
  if (fixedPage !== undefined) {
    return { page: fixedPage }
  }
  const eventId = EVENT_PATH.exec(path)?.[1]
  return eventId === undefined ? { page: 'notFound' } : { page: 'event', eventId: eventId.toLowerCase() }
}

export function eventPath(eventId: string): string {
  return `${PATHS.events}/${eventId}`
}

/** O perfil e as páginas dentro dele, para a navegação marcar "Meu perfil" como a página atual. */
export function isProfileRoute(route: Route): boolean {
  return route.page === 'profile' || route.page === 'blockedAccounts'
}

/** A lista de eventos e cada evento, para a navegação marcar "Eventos" como a página atual. */
export function isEventsRoute(route: Route): boolean {
  return route.page === 'events' || route.page === 'event'
}
