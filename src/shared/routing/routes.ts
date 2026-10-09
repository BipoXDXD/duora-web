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
  connections: '/conexoes',
  adminNewEvent: '/admin/eventos/novo',
} as const

type FixedPage = keyof typeof PATHS

/** A página aberta. Só as de um evento têm parâmetro: o id, sempre em minúsculas. */
export type Route =
  | { readonly page: FixedPage }
  | { readonly page: 'event'; readonly eventId: string }
  | { readonly page: 'adminEvent'; readonly eventId: string }
  | { readonly page: 'notFound' }

/** Toda página de PATHS; o teste confere que nenhuma ficou de fora. */
const FIXED_PAGES: readonly FixedPage[] = [
  'home',
  'profile',
  'blockedAccounts',
  'events',
  'registrations',
  'connections',
  'adminNewEvent',
]

const TRAILING_SLASH = /(?<=.)\/$/

/** O id no formato UUID que a API usa; outro texto no lugar do id é página inexistente. */
const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
/** `/eventos/{id}`: o evento. Só o id aceita maiúsculas; o resto do caminho é exato. */
const EVENT_PATH = new RegExp(`^/eventos/(${UUID})$`)

/** `/admin/eventos/{id}`: o evento visto pela equipe. Quem pode abrir é decidido pela API, nunca por esta rota. */
const ADMIN_EVENT_PATH = new RegExp(`^/admin/eventos/(${UUID})$`)

export function routeOf(pathname: string): Route {
  const path = pathname.replace(TRAILING_SLASH, '')
  const fixedPage = FIXED_PAGES.find((page) => PATHS[page] === path)
  if (fixedPage !== undefined) {
    return { page: fixedPage }
  }
  const eventId = EVENT_PATH.exec(path)?.[1]
  if (eventId !== undefined) {
    return { page: 'event', eventId: eventId.toLowerCase() }
  }
  const adminEventId = ADMIN_EVENT_PATH.exec(path)?.[1]
  return adminEventId === undefined ? { page: 'notFound' } : { page: 'adminEvent', eventId: adminEventId.toLowerCase() }
}

export function eventPath(eventId: string): string {
  return `${PATHS.events}/${eventId}`
}

export function adminEventPath(eventId: string): string {
  return `/admin/eventos/${eventId}`
}

/** O perfil e as páginas dentro dele, para a navegação marcar "Meu perfil" como a página atual. */
export function isProfileRoute(route: Route): boolean {
  return route.page === 'profile' || route.page === 'blockedAccounts'
}

/**
 * Os eventos, cada evento e as próprias inscrições (que se abrem a partir dos eventos), para a navegação
 * marcar "Eventos" como a página atual.
 */
export function isEventsRoute(route: Route): boolean {
  return route.page === 'events' || route.page === 'event' || route.page === 'registrations'
}
