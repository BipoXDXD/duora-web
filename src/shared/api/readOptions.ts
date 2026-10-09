import { isBug } from './http.ts'

/** Sem retry automático: a tela mostra a falha na hora e oferece tentar de novo, como no resto do app. */
export const READ_OPTIONS = { retry: false, refetchOnWindowFocus: false, throwOnError: isBug } as const
