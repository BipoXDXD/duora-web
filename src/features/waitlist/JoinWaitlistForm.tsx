import { useId, useState, type FormEvent } from 'react'
import { joinWaitlist, type JoinWaitlistResult } from './joinWaitlist.ts'

type FormState =
  | { readonly kind: 'editing' }
  | { readonly kind: 'blankEmail' }
  | { readonly kind: 'submitting' }
  | JoinWaitlistResult

type ProblemState = Exclude<FormState, { kind: 'editing' | 'submitting' | 'joined' }>

/** Mesmo limite do EmailAddress da duora-api (RFC 5321). O formato quem decide é a API. */
const EMAIL_MAX_LENGTH = 254
const SECONDS_PER_MINUTE = 60

export function JoinWaitlistForm() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<FormState>({ kind: 'editing' })
  const emailId = useId()
  const problemId = useId()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const typed = email.trim()
    if (typed === '') {
      setState({ kind: 'blankEmail' })
      return
    }
    setState({ kind: 'submitting' })
    setState(await joinWaitlist(typed))
  }

  if (state.kind === 'joined') {
    return (
      <p role="status" className="max-w-lg rounded-lg bg-primary-subtle p-4 font-semibold text-on-primary-subtle">
        Pronto! Vamos avisar você por e-mail quando o Duora abrir.
      </p>
    )
  }

  const isSubmitting = state.kind === 'submitting'
  const problem = state.kind === 'editing' || state.kind === 'submitting' ? null : state
  const isEmailRejected = problem?.kind === 'blankEmail' || problem?.kind === 'invalidEmail'

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex w-full max-w-lg flex-col gap-2">
      <label htmlFor={emailId} className="font-semibold text-fg">
        E-mail
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id={emailId}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          maxLength={EMAIL_MAX_LENGTH}
          required
          value={email}
          onChange={(event) => setEmail(event.currentTarget.value)}
          aria-invalid={isEmailRejected}
          aria-describedby={problem === null ? undefined : problemId}
          className="min-h-12 min-w-11 flex-1 rounded-lg border border-edge bg-surface px-4 text-base text-fg shadow-raised aria-invalid:border-danger"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-12 min-w-11 rounded-lg bg-primary px-6 font-semibold text-on-primary shadow-raised hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-disabled disabled:text-on-disabled"
        >
          {isSubmitting ? 'Enviando…' : 'Entrar na lista'}
        </button>
      </div>
      {problem !== null && (
        <p id={problemId} role="alert" className="text-sm font-semibold text-danger">
          {messageFor(problem)}
        </p>
      )}
    </form>
  )
}

function messageFor(problem: ProblemState): string {
  switch (problem.kind) {
    case 'blankEmail':
      return 'Informe seu e-mail.'
    case 'invalidEmail':
      return 'Confira o e-mail: ele não parece válido.'
    case 'tooManyAttempts':
      return `Muitas tentativas. Tente de novo ${waitText(problem.retryAfterSeconds)}.`
    case 'failed':
      return 'Não foi possível enviar agora. Tente de novo em instantes.'
  }
}

function waitText(retryAfterSeconds: number | null): string {
  if (retryAfterSeconds === null) {
    return 'mais tarde'
  }
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / SECONDS_PER_MINUTE))
  return minutes === 1 ? 'em 1 minuto' : `em ${minutes} minutos`
}
