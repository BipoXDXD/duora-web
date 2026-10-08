import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { isBug } from '../../shared/api/http.ts'
import { AppLink } from '../../shared/routing/AppLink.tsx'
import { PATHS } from '../../shared/routing/routes.ts'
import { LoadFailure } from '../../shared/ui/LoadFailure.tsx'
import { PRIMARY_BUTTON, SECONDARY_BUTTON, TEXT_LINK } from '../../shared/ui/styles.ts'
import { useFocusOnMount } from '../../shared/ui/useFocusOnMount.ts'
import { LOGIN_URL } from '../auth/loginUrl.ts'
import { READ_OPTIONS } from '../events/eventQueries.ts'
import { formatDay } from '../events/eventText.ts'
import { CONNECTION_KEYS } from './connectionQueries.ts'
import { decide, fetchDecision, type Decision } from './decision.ts'
import { noticeOfDecide, type DecisionNotice } from './decisionNotices.ts'

interface DecisionPanelProps {
  readonly eventId: string
  readonly roundNumber: number
}

/** Aviso mostrado; o número muda a cada resposta, para o mesmo aviso repetido ser anunciado de novo. */
interface ShownNotice {
  readonly notice: DecisionNotice
  readonly id: number
}

/**
 * A decisão privada depois de uma rodada em que a pessoa formou dupla: continuar em contato ou não. Tudo o que
 * a tela mostra vem da própria decisão; o front nunca recebe a do par.
 */
export function DecisionPanel({ eventId, roundNumber }: DecisionPanelProps) {
  const queryClient = useQueryClient()
  const decisionKey = CONNECTION_KEYS.decision(eventId, roundNumber)
  const query = useQuery({
    queryKey: decisionKey,
    queryFn: () => fetchDecision(eventId, roundNumber),
    ...READ_OPTIONS,
  })
  const [shown, setShown] = useState<ShownNotice | null>(null)
  const headingId = useId()

  const mutation = useMutation({
    mutationFn: (interested: boolean) => decide(eventId, roundNumber, interested),
    throwOnError: isBug,
    onSuccess: (result) => {
      if (result.kind === 'decided') {
        queryClient.setQueryData(decisionKey, result.decision)
        // Um "sim" pode ter completado uma conexão; a lista é relida quando for aberta, sem nada nesta tela.
        void queryClient.invalidateQueries({ queryKey: CONNECTION_KEYS.list })
      }
      if (result.kind === 'alreadyDecided') {
        void queryClient.invalidateQueries({ queryKey: decisionKey })
      }
      setShown((previous) => ({ notice: noticeOfDecide(result), id: (previous?.id ?? 0) + 1 }))
    },
  })

  // mt-4 soma ao gap do pai: mais espaço acima do título do que entre ele e o conteúdo que abre.
  return (
    <section aria-labelledby={headingId} className="mt-4 flex w-full flex-col items-start gap-4">
      <h3 id={headingId} className="font-display text-xl font-medium text-fg">
        Continuar em contato?
      </h3>
      {shown !== null && <NoticeMessage key={shown.id} notice={shown.notice} />}
      <DecisionBody
        decision={query.data}
        hasFailed={query.isError}
        isSaving={mutation.isPending}
        hasNextStep={shown?.notice.action != null}
        onRetry={() => void query.refetch()}
        onConfirm={(interested) => mutation.mutate(interested)}
      />
    </section>
  )
}

interface DecisionBodyProps {
  /** `undefined` enquanto a leitura não chegou; `null` sem decisão. */
  readonly decision: Decision | null | undefined
  readonly hasFailed: boolean
  readonly isSaving: boolean
  /** O aviso mostrado traz um passo a seguir (entrar de novo), que passa a ser o botão primário. */
  readonly hasNextStep: boolean
  readonly onRetry: () => void
  readonly onConfirm: (interested: boolean) => void
}

function DecisionBody({ decision, hasFailed, isSaving, hasNextStep, onRetry, onConfirm }: DecisionBodyProps) {
  if (decision === undefined) {
    return hasFailed ? (
      <LoadFailure message="Não foi possível ver sua decisão." onRetry={onRetry} />
    ) : (
      <p role="status" className="text-fg-muted">
        Verificando sua decisão…
      </p>
    )
  }
  if (decision === null) {
    return <Choice isSaving={isSaving} hasNextStep={hasNextStep} onConfirm={onConfirm} />
  }
  return <Decided decision={decision} />
}

/** Sucesso recebe o foco, porque o botão usado some; erro é alerta e o foco fica no botão para tentar de novo. */
function NoticeMessage({ notice }: { readonly notice: DecisionNotice }) {
  const ref = useFocusOnMount<HTMLDivElement>()
  const isSuccess = notice.tone === 'success'
  return (
    <div
      ref={isSuccess ? ref : undefined}
      tabIndex={isSuccess ? -1 : undefined}
      role={isSuccess ? 'status' : 'alert'}
      className={
        isSuccess
          ? 'w-full rounded-lg bg-primary-subtle p-4 font-semibold text-on-primary-subtle'
          : 'flex flex-col items-start gap-3 font-semibold text-danger'
      }
    >
      <p>{notice.text}</p>
      {notice.action === 'signIn' && (
        <a href={LOGIN_URL} className={PRIMARY_BUTTON}>
          Entrar de novo
        </a>
      )}
    </div>
  )
}

const CHOICES = [
  { interested: true, button: 'Quero continuar em contato' },
  { interested: false, button: 'Não quero' },
] as const

type ChoiceStep =
  | { readonly kind: 'choosing'; readonly focusOn: boolean | null }
  | { readonly kind: 'confirming'; readonly interested: boolean }

interface ChoiceProps {
  readonly isSaving: boolean
  readonly hasNextStep: boolean
  readonly onConfirm: (interested: boolean) => void
}

/**
 * Escolher e depois confirmar, porque a decisão é final. As duas opções têm o mesmo peso visual: a tela não
 * empurra para nenhuma.
 */
function Choice({ isSaving, hasNextStep, onConfirm }: ChoiceProps) {
  const [step, setStep] = useState<ChoiceStep>({ kind: 'choosing', focusOn: null })

  if (step.kind === 'confirming') {
    return (
      <ConfirmChoice
        interested={step.interested}
        isSaving={isSaving}
        hasNextStep={hasNextStep}
        onConfirm={() => onConfirm(step.interested)}
        onBack={() => setStep({ kind: 'choosing', focusOn: step.interested })}
      />
    )
  }
  return (
    <>
      <p className="text-fg">
        Só você vê sua resposta: a outra pessoa nunca fica sabendo o que você escolheu. Se as duas quiserem, vocês
        viram uma conexão.
      </p>
      <div className="flex flex-wrap gap-4">
        {CHOICES.map((choice) => (
          <ChoiceButton
            key={choice.button}
            label={choice.button}
            hasFocus={step.focusOn === choice.interested}
            onClick={() => setStep({ kind: 'confirming', interested: choice.interested })}
          />
        ))}
      </div>
    </>
  )
}

interface ChoiceButtonProps {
  readonly label: string
  readonly hasFocus: boolean
  readonly onClick: () => void
}

function ChoiceButton({ label, hasFocus, onClick }: ChoiceButtonProps) {
  const ref = useFocusOnMount<HTMLButtonElement>()
  return (
    <button ref={hasFocus ? ref : undefined} type="button" onClick={onClick} className={SECONDARY_BUTTON}>
      {label}
    </button>
  )
}

interface ConfirmChoiceProps {
  readonly interested: boolean
  readonly isSaving: boolean
  readonly hasNextStep: boolean
  readonly onConfirm: () => void
  readonly onBack: () => void
}

function ConfirmChoice({ interested, isSaving, hasNextStep, onConfirm, onBack }: ConfirmChoiceProps) {
  const confirmRef = useFocusOnMount<HTMLButtonElement>()
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="font-semibold text-fg">{`Você escolheu: ${chosenText(interested)}.`}</p>
      <p className="text-fg">A decisão é final: depois de confirmar, não dá para mudar. Ela continua só sua.</p>
      <div className="flex flex-wrap gap-4">
        <button
          ref={confirmRef}
          type="button"
          onClick={onConfirm}
          disabled={isSaving}
          className={hasNextStep ? SECONDARY_BUTTON : PRIMARY_BUTTON}
        >
          {isSaving ? 'Registrando…' : 'Confirmar minha decisão'}
        </button>
        <button type="button" onClick={onBack} disabled={isSaving} className={SECONDARY_BUTTON}>
          Voltar
        </button>
      </div>
    </div>
  )
}

/** A decisão já gravada. O texto depende só dela: é o mesmo, diga o par o que disser. */
function Decided({ decision }: { readonly decision: Decision }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="font-semibold text-fg">
        {decision.interested
          ? 'Sua decisão: você quer continuar em contato.'
          : 'Sua decisão: você não quer continuar em contato.'}
      </p>
      <p className="text-fg-muted">
        {`Registrada em ${formatDay(decision.decidedAt)}. A decisão é final, e só você a vê.`}
      </p>
      {decision.interested && (
        <>
          <p className="text-fg-muted">Se a outra pessoa também quiser, a conexão aparece em Conexões.</p>
          <AppLink to={PATHS.connections} className={TEXT_LINK}>
            Ver minhas conexões
          </AppLink>
        </>
      )}
    </div>
  )
}

function chosenText(interested: boolean): string {
  return interested ? 'quero continuar em contato' : 'não quero continuar em contato'
}
