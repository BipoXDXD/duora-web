import { LOGIN_URL } from './loginUrl.ts'
import type { CurrentUser } from './session.ts'
import { useLogout, useSession } from './useSession.ts'

const LOGOUT_FAILED = 'Não foi possível sair. Tente de novo.'
const SESSION_UNAVAILABLE = 'Não foi possível verificar sua sessão.'
const RETRY = 'Tentar de novo'

/** Botão secundário (contorno), o mesmo do "Entrar": a ação principal da página é a lista de espera. */
const OUTLINE_CLASS = 'border border-edge font-semibold text-fg hover:border-fg disabled:cursor-wait disabled:text-fg-muted'
const HEADER_CONTROL_CLASS = `inline-flex min-h-11 min-w-11 items-center rounded-lg px-4 ${OUTLINE_CLASS}`

/** Mensagem que flutua sobre a barra inferior, para não espremer as abas. */
const FLOATING_MESSAGE_CLASS =
  'absolute inset-x-4 bottom-full mb-2 rounded-lg bg-surface p-3 text-sm font-semibold shadow-raised'

/** Cabeçalho do desktop: "Entrar", ou quem está logado e "Sair". */
export function HeaderSessionControls() {
  const session = useSession()
  switch (session.kind) {
    case 'loading':
      return <SessionPlaceholder className="h-11 w-24 bg-surface" />
    case 'anonymous':
      return (
        <a href={LOGIN_URL} className={HEADER_CONTROL_CLASS}>
          Entrar
        </a>
      )
    case 'authenticated':
      return (
        <div className="flex items-center gap-4">
          <UserGreeting user={session.user} className="max-w-48 truncate border-l border-divider pl-6 text-fg-muted" />
          <LogoutButton className={HEADER_CONTROL_CLASS} alertClassName="text-sm font-semibold text-danger" />
        </div>
      )
    case 'error':
      return (
        <div className="flex items-center gap-4">
          <p className="text-sm text-fg-muted">{SESSION_UNAVAILABLE}</p>
          <button type="button" onClick={session.retry} className={HEADER_CONTROL_CLASS}>
            {RETRY}
          </button>
        </div>
      )
  }
}

/** Cabeçalho do celular: só o nome, porque o "Sair" fica na barra inferior, ao alcance do polegar. */
export function HeaderGreeting() {
  const session = useSession()
  if (session.kind !== 'authenticated') {
    return null
  }
  return <UserGreeting user={session.user} className="ml-auto max-w-40 truncate text-sm text-fg-muted" />
}

interface SessionTabProps {
  /** Classe das abas da barra inferior, para esta aba ter o mesmo tamanho das outras. */
  readonly tabClassName: string
}

/** Aba da barra inferior do celular: "Entrar", "Sair" ou "Tentar de novo". */
export function SessionTab({ tabClassName }: SessionTabProps) {
  const session = useSession()
  const controlClass = `${tabClassName} ${OUTLINE_CLASS}`
  switch (session.kind) {
    case 'loading':
      return <SessionPlaceholder className={`${tabClassName} bg-canvas`} />
    case 'anonymous':
      return (
        <a href={LOGIN_URL} className={controlClass}>
          Entrar
        </a>
      )
    case 'authenticated':
      return <LogoutButton className={controlClass} alertClassName={`${FLOATING_MESSAGE_CLASS} text-danger`} />
    case 'error':
      return (
        <>
          <p className={`${FLOATING_MESSAGE_CLASS} text-fg-muted`}>{SESSION_UNAVAILABLE}</p>
          <button type="button" onClick={session.retry} className={controlClass}>
            {RETRY}
          </button>
        </>
      )
  }
}

interface LogoutButtonProps {
  readonly className: string
  readonly alertClassName: string
}

/** O alerta fica fora do botão e é anunciado na hora; o foco continua no botão para tentar de novo. */
function LogoutButton({ className, alertClassName }: LogoutButtonProps) {
  const { state, logOut } = useLogout()
  const isLoggingOut = state === 'loggingOut'
  return (
    <>
      {state === 'failed' && (
        <p role="alert" className={alertClassName}>
          {LOGOUT_FAILED}
        </p>
      )}
      <button type="button" onClick={logOut} disabled={isLoggingOut} className={className}>
        {isLoggingOut ? 'Saindo…' : 'Sair'}
      </button>
    </>
  )
}

interface UserGreetingProps {
  readonly user: CurrentUser
  readonly className: string
}

/** O nome aparece sozinho; o leitor de tela ouve a frase inteira ("Você entrou como Ana"). */
function UserGreeting({ user, className }: UserGreetingProps) {
  if (user.displayName === null) {
    return <span className={className}>Você entrou</span>
  }
  return (
    <span className={className} title={user.displayName}>
      <span className="sr-only">Você entrou como </span>
      {user.displayName}
    </span>
  )
}

/** Ocupa o lugar do controle enquanto a sessão é verificada, para o cabeçalho não pular. */
function SessionPlaceholder({ className }: { readonly className: string }) {
  return (
    <span className={`inline-flex animate-pulse rounded-lg ${className}`}>
      <span className="sr-only">Verificando sua sessão…</span>
    </span>
  )
}
