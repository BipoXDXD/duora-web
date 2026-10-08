import { useQuery } from '@tanstack/react-query'
import { useId, useState, type FormEvent } from 'react'
import { DecisionPanel } from '../connections/DecisionPanel.tsx'
import { LoadFailure } from '../../shared/ui/LoadFailure.tsx'
import { FIELD_CONTROL, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../shared/ui/styles.ts'
import { EVENT_KEYS, READ_OPTIONS } from './eventQueries.ts'
import { accountCode, parseRoundNumber } from './eventText.ts'
import { fetchPairing, LAST_ROUND, type Pairing } from './pairing.ts'

interface PairingPanelProps {
  readonly eventId: string
}

const FIRST_ROUND_TEXT = '1'

/**
 * "Sua dupla na rodada N" para quem está inscrito num evento em andamento. O front não sabe quantas rodadas
 * existem nem qual está valendo: a pessoa digita o número (o anfitrião anuncia) e pode avançar para a próxima.
 */
export function PairingPanel({ eventId }: PairingPanelProps) {
  const [roundText, setRoundText] = useState(FIRST_ROUND_TEXT)
  const [round, setRound] = useState<number | null>(null)
  const [isRoundInvalid, setIsRoundInvalid] = useState(false)
  const headingId = useId()
  const fieldId = useId()
  const problemId = useId()
  const query = useQuery({
    queryKey: EVENT_KEYS.pairing(eventId, round ?? 0),
    queryFn: () => fetchPairing(eventId, round ?? 0),
    enabled: round !== null,
    ...READ_OPTIONS,
  })

  function showRound(next: number) {
    setIsRoundInvalid(false)
    setRoundText(String(next))
    if (next === round) {
      void query.refetch()
    } else {
      setRound(next)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = parseRoundNumber(roundText)
    if (parsed === null) {
      setIsRoundInvalid(true)
      return
    }
    showRound(parsed)
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col items-start gap-4">
      <h2 id={headingId} className="font-display text-2xl font-medium text-fg">
        Sua dupla
      </h2>
      <p className="text-fg-muted">Informe a rodada que o anfitrião anunciou.</p>
      <form noValidate onSubmit={submit} className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor={fieldId} className="font-semibold text-fg">
            Rodada
          </label>
          <input
            id={fieldId}
            type="text"
            inputMode="numeric"
            value={roundText}
            onChange={(event) => setRoundText(event.target.value)}
            aria-invalid={isRoundInvalid}
            aria-describedby={isRoundInvalid ? problemId : undefined}
            className={`${FIELD_CONTROL} max-w-28`}
          />
        </div>
        <button type="submit" className={PRIMARY_BUTTON}>
          Ver minha dupla
        </button>
      </form>
      {isRoundInvalid && (
        <p id={problemId} className="text-sm font-semibold text-danger">
          {`Informe um número de rodada de 1 a ${LAST_ROUND}.`}
        </p>
      )}
      <div aria-live="polite" className="flex w-full flex-col items-start gap-4">
        {round !== null && (
          <RoundResult
            eventId={eventId}
            round={round}
            pairing={query.data}
            isLoading={query.isFetching}
            hasFailed={query.isError}
            onRetry={() => void query.refetch()}
            onNextRound={() => showRound(round + 1)}
          />
        )}
      </div>
    </section>
  )
}

interface RoundResultProps {
  readonly eventId: string
  readonly round: number
  readonly pairing: Pairing | undefined
  readonly isLoading: boolean
  readonly hasFailed: boolean
  readonly onRetry: () => void
  readonly onNextRound: () => void
}

function RoundResult({ eventId, round, pairing, isLoading, hasFailed, onRetry, onNextRound }: RoundResultProps) {
  if (isLoading) {
    return <p className="text-fg-muted">{`Procurando sua dupla na rodada ${round}…`}</p>
  }
  if (hasFailed || pairing === undefined) {
    return <LoadFailure message={`Não foi possível ver sua dupla na rodada ${round}.`} onRetry={onRetry} />
  }
  return (
    <>
      <p className="w-full rounded-lg bg-surface p-4 text-lg text-fg shadow-raised">{pairingText(round, pairing)}</p>
      {pairing.kind === 'paired' && <DecisionPanel key={round} eventId={eventId} roundNumber={round} />}
      {round < LAST_ROUND && (
        <button type="button" onClick={onNextRound} className={SECONDARY_BUTTON}>
          {`Ver a rodada ${round + 1}`}
        </button>
      )}
    </>
  )
}

function pairingText(round: number, pairing: Pairing): string {
  switch (pairing.kind) {
    case 'paired':
      return `Sua dupla na rodada ${round} é a conta ${accountCode(pairing.partnerAccountId)}.`
    case 'sittingOut':
      return `Na rodada ${round} você ficou de fora. Na próxima, quem ficou de fora tem prioridade.`
    case 'notInRound':
      return `A rodada ${round} ainda não começou, ou você não estava nela.`
  }
}
