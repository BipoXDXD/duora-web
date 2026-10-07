/**
 * As páginas do app e o caminho de cada uma. Um caminho só por página; a barra no fim é tolerada porque
 * o navegador a acrescenta às vezes.
 */
export const PATHS = {
  home: '/',
  profile: '/perfil',
  blockedAccounts: '/perfil/bloqueios',
} as const

type PageRoute = keyof typeof PATHS

export type Route = PageRoute | 'notFound'

/** Toda página de PATHS; o teste confere que nenhuma ficou de fora. */
const PAGE_ROUTES: readonly PageRoute[] = ['home', 'profile', 'blockedAccounts']

const TRAILING_SLASH = /(?<=.)\/$/

export function routeOf(pathname: string): Route {
  const path = pathname.replace(TRAILING_SLASH, '')
  return PAGE_ROUTES.find((route) => PATHS[route] === path) ?? 'notFound'
}
