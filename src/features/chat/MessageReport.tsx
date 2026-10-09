import { useId, useRef, useState, type FormEvent, type RefObject } from 'react'
import { hasStatus, isApiFailure } from '../../shared/api/http.ts'
import { UNAUTHORIZED } from '../../shared/api/httpStatus.ts'
import { AppLink } from '../../shared/routing/AppLink.tsx'
import { PATHS } from '../../shared/routing/routes.ts'
import { FIELD_CONTROL, PRIMARY_BUTTON, SECONDARY_BUTTON, TEXT_LINK } from '../../shared/ui/styles.ts'
import { useFocusOnMount } from '../../shared/ui/useFocusOnMount.ts'
import { LOGIN_URL } from '../auth/loginUrl.ts'
import { blockAccount } from '../blocks/blockedAccounts.ts'
import type { ChatMessage } from './chat.ts'
import { REPORT_REASONS, reportMessage, type ReportReason } from './messageReport.ts'
import {
  DESCRIPTION_MAX_LENGTH,
  descriptionLength,
  messageExcerpt,
  parseReportDraft,
  problemsFromApi,
  quotaWaitText,
  type DescriptionProblem,
  type ReasonProblem,
  type ReportProblems,
} from './reportForm.ts'
import type { BlockOutcome, Confirmation, MessageReports, ReportTarget } from './useMessageReports.ts'
import { useRethrowInRender } from './useRoundChat.ts'

interface ReportActionProps {
  readonly reports: MessageReports
  readonly message: ChatMessage
}

/**
 * O botão "Denunciar" de uma mensagem do par, ou a marca depois da denúncia. O contêiner fica o mesmo e a marca
 * é texto puro: a lista é `aria-relevant="additions"`, e trocar o botão pela marca não a anuncia de novo (quem
 * anuncia a denúncia é a confirmação).
 */
export function ReportAction({ reports, message }: ReportActionProps) {
  const isReported = reports.reportedSeqs.has(message.seq)
  return (
    <span className={isReported ? 'rounded-lg border border-edge px-3 py-1 text-sm font-semibold text-fg' : 'contents'}>
      {isReported ? (
        'Denunciada por você'
      ) : (
        <button
          ref={(button) => reports.registerButton(message.seq, button)}
          type="button"
          onClick={() => reports.start({ seq: message.seq, text: message.text })}
          aria-label={`Denunciar a mensagem “${messageExcerpt(message.text)}”`}
          className="inline-flex min-h-11 min-w-11 items-center text-sm font-semibold text-fg-muted underline underline-offset-4 hover:text-fg"
        >
          Denunciar
        </button>
      )}
    </span>
  )
}

interface ReportFlowProps {
  readonly eventId: string
  readonly roundNumber: number
  readonly reports: MessageReports
}

/** O formulário da denúncia aberta, ou a confirmação da última. Fica fora da lista, que é região viva. */
export function ReportFlow({ eventId, roundNumber, reports }: ReportFlowProps) {
  const { target, confirmation } = reports
  if (target !== null) {
    return <ReportForm key={target.seq} eventId={eventId} roundNumber={roundNumber} target={target} reports={reports} />
  }
  return confirmation === null ? null : <ReportConfirmation confirmation={confirmation} onBlockSettled={reports.updateBlock} />
}

interface ReasonText {
  readonly label: string
  readonly hint: string
}

const REASON_TEXT: Readonly<Record<ReportReason, ReasonText>> = {
  HARASSMENT: { label: 'Assédio ou intimidação', hint: 'Insistência depois de um não, ofensas, perseguição.' },
  HATE_SPEECH: {
    label: 'Discurso de ódio',
    hint: 'Ataque por raça, religião, gênero, orientação sexual, deficiência ou origem.',
  },
  SEXUAL_CONTENT: { label: 'Conteúdo sexual indesejado', hint: 'Mensagens ou pedidos sexuais que você não quis.' },
  VIOLENCE_OR_THREAT: { label: 'Violência ou ameaça', hint: 'Ameaça a você ou a outra pessoa, ou incentivo à violência.' },
  SCAM_OR_SPAM: { label: 'Golpe ou spam', hint: 'Pedido de dinheiro ou de dados, link suspeito, propaganda.' },
  FAKE_PROFILE: { label: 'Perfil falso', hint: 'A pessoa finge ser quem não é.' },
  SUSPECTED_MINOR: { label: 'Parece menor de idade', hint: 'O Duora é só para maiores de 18 anos.' },
  OTHER: { label: 'Outro motivo', hint: 'Conte o que aconteceu na descrição.' },
}

const REASON_PROBLEM_TEXT: Readonly<Record<ReasonProblem, string>> = {
  required: 'Escolha um motivo.',
  rejected: 'Este motivo não foi aceito. Escolha outro.',
}

const DESCRIPTION_PROBLEM_TEXT: Readonly<Record<DescriptionProblem, string>> = {
  requiredForOther: 'Conte o que aconteceu: com “Outro motivo”, a descrição é obrigatória.',
  tooLong: `A descrição passou de ${DESCRIPTION_MAX_LENGTH} caracteres. Encurte para enviar.`,
  forbiddenCharacter: 'A descrição tem um caractere que não é aceito. Tire-o e envie de novo.',
  rejected: 'A descrição não foi aceita. Revise o texto e envie de novo.',
}

/** A recusa da denúncia inteira, fora dos campos. */
type Refusal =
  | { readonly kind: 'rejected' | 'notFound' | 'unavailable' | 'signedOut' | 'failed' }
  | { readonly kind: 'quotaExhausted'; readonly retryAfterSeconds: number | null }

const NO_PROBLEMS: ReportProblems = { reason: null, description: null }

interface ReportFormProps {
  readonly eventId: string
  readonly roundNumber: number
  readonly target: ReportTarget
  readonly reports: MessageReports
}

/**
 * Motivo, descrição e o bloqueio opcional. O bloqueio só é chamado depois do 201: se falhar, a denúncia continua
 * feita e a confirmação diz isso. Erro de campo vai para o campo, com o foco nele; o resto é alerta.
 */
function ReportForm({ eventId, roundNumber, target, reports }: ReportFormProps) {
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [description, setDescription] = useState('')
  const [alsoBlock, setAlsoBlock] = useState(false)
  const [problems, setProblems] = useState<ReportProblems>(NO_PROBLEMS)
  const [refusal, setRefusal] = useState<Refusal | null>(null)
  const [isSending, setSending] = useState(false)
  const headingRef = useFocusOnMount<HTMLHeadingElement>()
  const firstReasonRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const rethrow = useRethrowInRender()
  const id = useId()

  function showProblems(found: ReportProblems) {
    setProblems(found)
    if (found.reason !== null) {
      firstReasonRef.current?.focus()
    } else if (found.description !== null) {
      descriptionRef.current?.focus()
    }
  }

  async function submit() {
    const parsed = parseReportDraft({ reason, description })
    setRefusal(null)
    if (parsed.kind === 'invalid') {
      showProblems(parsed.problems)
      return
    }
    setProblems(NO_PROBLEMS)
    setSending(true)
    const result = await reportMessage(eventId, roundNumber, target.seq, parsed.body)
    if (result.kind === 'reported') {
      const block = alsoBlock ? await blockReported(result.reportedAccountId) : 'notRequested'
      reports.finish(target.seq, { reportedAccountId: result.reportedAccountId, block })
      return
    }
    setSending(false)
    if (result.kind === 'invalid') {
      const fieldProblems = problemsFromApi(result.fieldErrors)
      if (fieldProblems === null) {
        setRefusal({ kind: 'rejected' })
      } else {
        showProblems(fieldProblems)
      }
      return
    }
    setRefusal(result)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!isSending) {
      submit().catch(rethrow)
    }
  }

  const headingId = `${id}-heading`
  return (
    <section aria-labelledby={headingId} className="flex w-full flex-col gap-4 rounded-lg bg-surface p-6 shadow-raised">
      <h4 ref={headingRef} id={headingId} tabIndex={-1} className="font-display text-lg font-medium text-fg">
        Denunciar mensagem
      </h4>
      <blockquote className="rounded-lg border-l-4 border-edge bg-canvas px-4 py-3 whitespace-pre-wrap break-words text-fg">
        {target.text}
      </blockquote>
      <p className="text-fg-muted">
        Uma cópia desta mensagem vai para a moderação do Duora, com o motivo e a descrição. Denunciar não bloqueia a
        pessoa: para isso, marque a opção abaixo.
      </p>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        <ReasonChoice
          reason={reason}
          problem={problems.reason}
          firstReasonRef={firstReasonRef}
          onChange={(next) => {
            setReason(next)
            setProblems(NO_PROBLEMS)
          }}
        />
        <DescriptionField
          fieldRef={descriptionRef}
          value={description}
          isRequired={reason === 'OTHER'}
          problem={problems.description}
          onChange={(next) => {
            setDescription(next)
            setProblems((current) => ({ ...current, description: null }))
          }}
        />
        <Choice
          type="checkbox"
          name={`${id}-block`}
          label="Também bloquear esta pessoa"
          hint="Vocês não poderão mais conversar. Para desfazer, use Contas bloqueadas, no seu perfil."
          checked={alsoBlock}
          onChange={() => setAlsoBlock((current) => !current)}
        />
        {refusal !== null && <RefusalAlert refusal={refusal} />}
        <div className="flex flex-wrap gap-4">
          <button type="submit" disabled={isSending} className={PRIMARY_BUTTON}>
            {submitLabel(isSending, alsoBlock)}
          </button>
          <button type="button" onClick={reports.cancel} disabled={isSending} className={SECONDARY_BUTTON}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  )
}

function submitLabel(isSending: boolean, alsoBlock: boolean): string {
  if (isSending) {
    return 'Enviando…'
  }
  return alsoBlock ? 'Enviar denúncia e bloquear' : 'Enviar denúncia'
}

/** Bloqueia depois da denúncia. Falha esperada vira resultado; bug sobe. */
async function blockReported(accountId: string): Promise<BlockOutcome> {
  try {
    await blockAccount(accountId)
    return 'blocked'
  } catch (error) {
    if (hasStatus(error, UNAUTHORIZED)) {
      return 'signedOut'
    }
    if (isApiFailure(error)) {
      return 'failed'
    }
    throw error
  }
}

interface ReasonChoiceProps {
  readonly reason: ReportReason | null
  readonly problem: ReasonProblem | null
  readonly firstReasonRef: RefObject<HTMLInputElement | null>
  readonly onChange: (reason: ReportReason) => void
}

function ReasonChoice({ reason, problem, firstReasonRef, onChange }: ReasonChoiceProps) {
  const id = useId()
  const labelId = `${id}-label`
  const problemId = `${id}-problem`
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      aria-describedby={problem === null ? undefined : problemId}
      aria-required
      aria-invalid={problem !== null}
      className="flex flex-col gap-2"
    >
      <p id={labelId} className="font-semibold text-fg">
        Motivo
      </p>
      {problem !== null && (
        <p id={problemId} className="text-sm font-semibold text-danger">
          {REASON_PROBLEM_TEXT[problem]}
        </p>
      )}
      {REPORT_REASONS.map((value, index) => (
        <Choice
          key={value}
          type="radio"
          name={`${id}-reason`}
          inputRef={index === 0 ? firstReasonRef : undefined}
          label={REASON_TEXT[value].label}
          hint={REASON_TEXT[value].hint}
          checked={reason === value}
          onChange={() => onChange(value)}
        />
      ))}
    </div>
  )
}

interface ChoiceProps {
  readonly type: 'radio' | 'checkbox'
  readonly name: string
  readonly label: string
  readonly hint: string
  readonly checked: boolean
  readonly onChange: () => void
  readonly inputRef?: RefObject<HTMLInputElement | null> | undefined
}

/**
 * Uma opção com nome e explicação. A linha inteira é o alvo de toque de 44px; o nome do controle é só o rótulo,
 * e a explicação vai como descrição, para o leitor de tela não ler tudo como nome.
 */
function Choice({ type, name, label, hint, checked, onChange, inputRef }: ChoiceProps) {
  const id = useId()
  const labelId = `${id}-label`
  const hintId = `${id}-hint`
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
      <input
        type={type}
        ref={inputRef}
        name={name}
        checked={checked}
        onChange={onChange}
        aria-labelledby={labelId}
        aria-describedby={hintId}
        className="mt-1 size-5 shrink-0 accent-primary"
      />
      <span className="flex flex-col gap-1">
        <span id={labelId} className="font-semibold text-fg">
          {label}
        </span>
        <span id={hintId} className="text-sm text-fg-muted">
          {hint}
        </span>
      </span>
    </label>
  )
}

interface DescriptionFieldProps {
  readonly fieldRef: RefObject<HTMLTextAreaElement | null>
  readonly value: string
  readonly isRequired: boolean
  readonly problem: DescriptionProblem | null
  readonly onChange: (value: string) => void
}

function DescriptionField({ fieldRef, value, isRequired, problem, onChange }: DescriptionFieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const problemId = `${id}-problem`
  const length = descriptionLength(value)
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-semibold text-fg">
        Descrição
      </label>
      <textarea
        ref={fieldRef}
        id={id}
        rows={4}
        value={value}
        required={isRequired}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={problem !== null}
        aria-describedby={problem === null ? hintId : `${problemId} ${hintId}`}
        className={`${FIELD_CONTROL} py-3`}
      />
      {problem !== null && (
        <p id={problemId} className="text-sm font-semibold text-danger">
          {DESCRIPTION_PROBLEM_TEXT[problem]}
        </p>
      )}
      <p id={hintId} className={length > DESCRIPTION_MAX_LENGTH ? 'text-sm font-semibold text-danger' : 'text-sm text-fg-muted'}>
        {`${isRequired ? 'Obrigatória' : 'Opcional'}. ${length} de ${DESCRIPTION_MAX_LENGTH} caracteres.`}
      </p>
    </div>
  )
}

function RefusalAlert({ refusal }: { readonly refusal: Refusal }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 font-semibold text-danger">
      <p>{refusalText(refusal)}</p>
      {refusal.kind === 'signedOut' && (
        <a href={LOGIN_URL} className={TEXT_LINK}>
          Entrar de novo
        </a>
      )}
    </div>
  )
}

function refusalText(refusal: Refusal): string {
  switch (refusal.kind) {
    case 'rejected':
      return 'A denúncia não foi aceita. Revise e envie de novo.'
    case 'notFound':
      return 'Não encontramos esta mensagem. Ela pode ter sido apagada com a conversa.'
    case 'quotaExhausted':
      return `Você atingiu o limite de denúncias de hoje. Você poderá denunciar de novo ${quotaWaitText(refusal.retryAfterSeconds)}.`
    case 'unavailable':
      return 'As denúncias estão indisponíveis agora. Tente de novo em instantes.'
    case 'signedOut':
      return 'Sua sessão terminou. Entre de novo para denunciar.'
    case 'failed':
      return 'Não foi possível enviar a denúncia. Tente de novo.'
  }
}

interface ReportConfirmationProps {
  readonly confirmation: Confirmation
  readonly onBlockSettled: (block: BlockOutcome) => void
}

/**
 * A confirmação recebe o foco, porque o formulário some. A falha do bloqueio é um alerta à parte, refeito a cada
 * tentativa para ser anunciado de novo.
 */
function ReportConfirmation({ confirmation, onBlockSettled }: ReportConfirmationProps) {
  const statusRef = useFocusOnMount<HTMLDivElement>()
  const [attempts, setAttempts] = useState(0)
  const [isBlocking, setBlocking] = useState(false)
  const rethrow = useRethrowInRender()
  const { block } = confirmation

  async function blockAgain() {
    setBlocking(true)
    const outcome = await blockReported(confirmation.reportedAccountId)
    setBlocking(false)
    setAttempts((current) => current + 1)
    onBlockSettled(outcome)
  }

  return (
    <div className="flex w-full flex-col items-start gap-3">
      <div
        ref={statusRef}
        tabIndex={-1}
        role="status"
        className="flex w-full flex-col gap-1 rounded-lg bg-primary-subtle p-4 text-on-primary-subtle"
      >
        <p className="font-semibold">Denúncia enviada. A moderação do Duora vai analisar a mensagem.</p>
        {block === 'blocked' && (
          <p>
            Você também bloqueou esta pessoa. Para desfazer, abra{' '}
            <AppLink to={PATHS.blockedAccounts} className={TEXT_LINK}>
              Contas bloqueadas
            </AppLink>
            .
          </p>
        )}
      </div>
      {block === 'failed' && (
        <div key={attempts} role="alert" className="flex flex-col items-start gap-3 font-semibold text-danger">
          <p>A denúncia está feita, mas o bloqueio não deu certo.</p>
          <button
            type="button"
            onClick={() => void blockAgain().catch(rethrow)}
            disabled={isBlocking}
            className={SECONDARY_BUTTON}
          >
            {isBlocking ? 'Bloqueando…' : 'Tentar bloquear de novo'}
          </button>
        </div>
      )}
      {block === 'signedOut' && (
        <div role="alert" className="flex flex-col items-start gap-3 font-semibold text-danger">
          <p>A denúncia está feita, mas sua sessão terminou antes do bloqueio. Entre de novo para bloquear.</p>
          <a href={LOGIN_URL} className={TEXT_LINK}>
            Entrar de novo
          </a>
        </div>
      )}
    </div>
  )
}
