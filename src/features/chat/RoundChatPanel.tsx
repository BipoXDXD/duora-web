import { useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { FIELD_CONTROL, PRIMARY_BUTTON, SECONDARY_BUTTON, TEXT_LINK } from '../../shared/ui/styles.ts'
import { LOGIN_URL } from '../auth/loginUrl.ts'
import type { ChatMessage } from './chat.ts'
import { draftProblemOf, MESSAGE_MAX_LENGTH, messageLength, type DraftProblem } from './chatDraft.ts'
import type { ChatLog, Pending, Received } from './chatLog.ts'
import { ReportAction, ReportFlow } from './MessageReport.tsx'
import { useMessageReports, type MessageReports } from './useMessageReports.ts'
import { useRoundChat } from './useRoundChat.ts'

interface RoundChatPanelProps {
  readonly eventId: string
  readonly roundNumber: number
}

/**
 * A conversa com a dupla da rodada. Aberta, lê e escreve; fechada, só lê, com um aviso que não diz por quê: a
 * rodada seguinte, o fim do evento, o chat cheio e um bloqueio chegam iguais da API, de propósito.
 */
export function RoundChatPanel({ eventId, roundNumber }: RoundChatPanelProps) {
  const chat = useRoundChat(eventId, roundNumber)
  const reports = useMessageReports()
  const headingId = useId()
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const { log } = chat

  function retry(pending: Pending) {
    chat.retry(pending)
    fieldRef.current?.focus()
  }

  // mt-4 soma ao gap do pai: mais espaço acima do título do que entre ele e o conteúdo que abre.
  return (
    <section aria-labelledby={headingId} className="mt-4 flex w-full flex-col items-start gap-4">
      <h3 id={headingId} className="font-display text-xl font-medium text-fg">
        Conversa com sua dupla
      </h3>
      {log.kind === 'notPaired' && <p className="text-fg">Não há conversa sua nesta rodada.</p>}
      {isLoading(log) && !chat.isReconnecting && !chat.isSignedOut && (
        <p role="status" className="text-fg-muted">
          Carregando a conversa…
        </p>
      )}
      {chat.isReconnecting && (
        <p role="status" className="text-fg-muted">
          Sem conexão com a conversa. Tentando de novo…
        </p>
      )}
      {chat.isSignedOut && (
        <div role="status">
          <SignedOutNotice className="items-start" />
        </div>
      )}
      {log.kind === 'ready' && (
        <>
          {!log.open && (
            <p className="w-full rounded-lg bg-surface p-4 text-fg shadow-raised">
              Esta conversa não recebe mais mensagens. O que foi dito continua aqui para ler.
            </p>
          )}
          <MessageLog
            isKnownEmpty={log.hasReadMessages && log.messages.length === 0}
            messages={log.messages}
            outgoing={log.outgoing}
            onRetry={retry}
            reports={reports}
          />
          <ReportFlow eventId={eventId} roundNumber={roundNumber} reports={reports} />
          {log.open && <Composer fieldRef={fieldRef} onSend={chat.send} />}
        </>
      )}
    </section>
  )
}

/** Ainda não há o que mostrar: o chat nem o acesso foram lidos, ou as mensagens ainda não responderam. */
function isLoading(log: ChatLog): boolean {
  return log.kind === 'loading' || (log.kind === 'ready' && !log.hasReadMessages)
}

interface MessageLogProps {
  /** Uma leitura respondeu que não há mensagens; "ainda não li" não vale. */
  readonly isKnownEmpty: boolean
  readonly messages: readonly Received[]
  readonly outgoing: readonly Pending[]
  readonly onRetry: (pending: Pending) => void
  readonly reports: MessageReports
}

/**
 * `aria-relevant="additions"`: o leitor de tela anuncia o item novo e não o fim do "Enviando…". A mensagem
 * própria continua no mesmo item depois de gravada, então não é anunciada de novo.
 */
function MessageLog({ isKnownEmpty, messages, outgoing, onRetry, reports }: MessageLogProps) {
  const isEmpty = isKnownEmpty && outgoing.length === 0
  return (
    <>
      {isEmpty && <p className="text-fg-muted">Nenhuma mensagem ainda.</p>}
      <ol
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Mensagens"
        className="flex w-full flex-col gap-3"
      >
        {/* Uma lista só: a chave do item pendente reaparece entre as gravadas, e o React mantém o mesmo nó. */}
        {[
          ...messages.map(({ key, message }) => (
            <MessageItem key={key} fromMe={message.fromMe} text={message.text}>
              <SentTime message={message} />
              {/* Só a mensagem do par pode ser denunciada; a própria nunca oferece a ação. */}
              {!message.fromMe && <ReportAction reports={reports} message={message} />}
            </MessageItem>
          )),
          ...outgoing.map((pending) => (
            <MessageItem key={pending.key} fromMe text={pending.text}>
              <PendingStatus pending={pending} onRetry={() => onRetry(pending)} />
            </MessageItem>
          )),
        ]}
      </ol>
    </>
  )
}

interface MessageItemProps {
  readonly fromMe: boolean
  readonly text: string
  readonly children: ReactNode
}

/**
 * O texto vai como texto comum (o React escapa), com as quebras de linha de quem escreveu. `wrap-anywhere` e não
 * `break-words`: só ele encolhe a largura mínima do balão, e sem isso uma mensagem sem espaços (500 caracteres
 * seguidos, um link) alarga a coluna inteira da página em vez de quebrar.
 */
function MessageItem({ fromMe, text, children }: MessageItemProps) {
  return (
    <li className={`flex max-w-[85%] flex-col gap-1 ${fromMe ? 'items-end self-end' : 'items-start self-start'}`}>
      <p
        className={`rounded-lg px-4 py-3 whitespace-pre-wrap wrap-anywhere ${
          fromMe ? 'bg-primary-subtle text-on-primary-subtle' : 'bg-surface text-fg shadow-raised'
        }`}
      >
        <span className="sr-only">{fromMe ? 'Você: ' : 'Sua dupla: '}</span>
        <span data-message-text>{text}</span>
      </p>
      {children}
    </li>
  )
}

const TIME_FORMAT = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

function SentTime({ message }: { readonly message: ChatMessage }) {
  return (
    <time dateTime={message.sentAt.toISOString()} className="text-sm text-fg-muted">
      {TIME_FORMAT.format(message.sentAt)}
    </time>
  )
}

interface PendingStatusProps {
  readonly pending: Pending
  readonly onRetry: () => void
}

function PendingStatus({ pending: { status }, onRetry }: PendingStatusProps) {
  switch (status.kind) {
    case 'sending':
      return <p className="text-sm text-fg-muted">Enviando…</p>
    case 'failed':
      return (
        <div className="flex flex-col items-end gap-1">
          <p className="text-sm font-semibold text-danger">
            {status.retryAfterSeconds === null
              ? 'Não foi enviada.'
              : `Não foi enviada. Tente de novo em ${status.retryAfterSeconds} s.`}
          </p>
          <button type="button" onClick={onRetry} className={SECONDARY_BUTTON}>
            Tentar enviar de novo
          </button>
        </div>
      )
    case 'signedOut':
      return <SignedOutNotice className="items-end" />
    case 'notSent':
      return <p className="text-sm font-semibold text-danger">Não foi enviada.</p>
  }
}

function SignedOutNotice({ className }: { readonly className: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <p className="text-sm font-semibold text-danger">Sua sessão terminou. Entre de novo para enviar.</p>
      <a href={LOGIN_URL} className={TEXT_LINK}>
        Entrar de novo
      </a>
    </div>
  )
}

const PROBLEM_TEXT: Readonly<Record<DraftProblem, string>> = {
  empty: 'Escreva uma mensagem antes de enviar.',
  tooLong: `A mensagem passou de ${MESSAGE_MAX_LENGTH} caracteres. Encurte para enviar.`,
  forbiddenCharacter: 'A mensagem tem um caractere que não é aceito. Tire-o e envie de novo.',
  rejected: 'A mensagem não foi aceita. Revise o texto e envie de novo.',
}

interface ComposerProps {
  readonly fieldRef: RefObject<HTMLTextAreaElement | null>
  readonly onSend: (text: string) => Promise<DraftProblem | null>
}

/**
 * O rascunho sai do campo assim que é enviado e aparece na lista como pendente. Se a API o recusar como
 * inválido, ele volta ao campo com o motivo, a menos que a pessoa já tenha começado outro.
 */
function Composer({ fieldRef, onSend }: ComposerProps) {
  const [draft, setDraft] = useState('')
  const [problem, setProblem] = useState<DraftProblem | null>(null)
  const id = useId()
  const counterId = `${id}-counter`
  const problemId = `${id}-problem`
  const length = messageLength(draft)

  async function submit() {
    const text = draft
    const localProblem = draftProblemOf(text)
    setProblem(localProblem)
    if (localProblem !== null) {
      return
    }
    setDraft('')
    fieldRef.current?.focus()
    const refused = await onSend(text)
    if (refused !== null) {
      setDraft((current) => (current === '' ? text : current))
      setProblem(refused)
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    void submit()
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void submit()
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex w-full flex-col gap-2">
      <label htmlFor={id} className="font-semibold text-fg">
        Sua mensagem
      </label>
      <textarea
        ref={fieldRef}
        id={id}
        rows={3}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
          setProblem(null)
        }}
        onKeyDown={onKeyDown}
        aria-invalid={problem !== null}
        aria-describedby={problem === null ? counterId : `${problemId} ${counterId}`}
        className={`${FIELD_CONTROL} py-3`}
      />
      {problem !== null && (
        <p id={problemId} role="alert" className="text-sm font-semibold text-danger">
          {PROBLEM_TEXT[problem]}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p id={counterId} className={length > MESSAGE_MAX_LENGTH ? 'text-sm font-semibold text-danger' : 'text-sm text-fg-muted'}>
          {`${length} de ${MESSAGE_MAX_LENGTH} caracteres. Enter envia; Shift+Enter quebra a linha.`}
        </p>
        <button type="submit" className={PRIMARY_BUTTON}>
          Enviar
        </button>
      </div>
    </form>
  )
}
