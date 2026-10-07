/**
 * Classes dos controles das telas do app, na pirâmide do Refactoring UI: primário sólido, secundário com
 * contorno, terciário como link. Todos com o alvo de toque de 44px.
 */
export const PRIMARY_BUTTON =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-primary px-6 font-semibold text-on-primary shadow-raised hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-disabled disabled:text-on-disabled'

export const SECONDARY_BUTTON =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-edge px-6 font-semibold text-fg hover:border-fg disabled:cursor-wait disabled:text-fg-muted'

export const TEXT_LINK =
  'inline-flex min-h-11 min-w-11 items-center font-semibold text-fg-accent underline underline-offset-4 hover:text-fg'

export const FIELD_CONTROL =
  'min-h-11 min-w-11 w-full rounded-lg border border-edge bg-surface px-4 text-base text-fg shadow-raised aria-invalid:border-danger'
