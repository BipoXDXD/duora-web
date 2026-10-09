/**
 * O aviso depois de uma ação. `action` é o próximo passo que a tela oferece junto (entrar de novo, completar o
 * perfil); cada tela diz quais passos oferece.
 */
export interface Notice<Action extends string = 'signIn'> {
  readonly tone: 'success' | 'error'
  readonly text: string
  readonly action: Action | null
}

export function successNotice(text: string): Notice<never> {
  return { tone: 'success', text, action: null }
}

export function errorNotice(text: string): Notice<never> {
  return { tone: 'error', text, action: null }
}

/** O 401 no meio do uso: a sessão acabou, e entrar de novo traz a pessoa de volta. */
export const SIGNED_OUT_NOTICE: Notice = {
  tone: 'error',
  text: 'Sua sessão terminou. Entre de novo para continuar.',
  action: 'signIn',
}
