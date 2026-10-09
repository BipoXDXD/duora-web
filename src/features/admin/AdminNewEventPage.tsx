import { FormField } from '../../shared/ui/FormField.tsx'
import { PageFrame } from '../../shared/ui/PageFrame.tsx'
import { FIELD_CONTROL, PRIMARY_BUTTON } from '../../shared/ui/styles.ts'
import { RequireSession } from '../auth/RequireSession.tsx'
import {
  DESCRIPTION_MAX_LENGTH,
  MAX_CAPACITY,
  MAX_DAYS_AHEAD,
  MAX_DURATION_HOURS,
  MIN_CAPACITY,
  TITLE_MAX_LENGTH,
  userTimeZone,
  type EventField,
  type EventFieldProblems,
} from './adminEventForm.ts'
import { AdminNoticeMessage } from './AdminNoticeMessage.tsx'
import { problemMessage, STAFF_ONLY_TEXT } from './adminText.ts'
import { useNewEventForm } from './useNewEventForm.ts'

/** "Novo evento": o formulário do rascunho. A API decide quem pode criar; o front não esconde nem concede nada. */
export function AdminNewEventPage() {
  return (
    <PageFrame title="Novo evento">
      <RequireSession signInMessage="Entre para criar um evento.">
        <NewEventForm />
      </RequireSession>
    </PageFrame>
  )
}

function NewEventForm() {
  const { formRef, values, problems, shown, isForbidden, isSaving, edit, save } = useNewEventForm()

  if (isForbidden) {
    return (
      <p role="alert" className="text-lg font-semibold text-danger">
        {STAFF_ONLY_TEXT}
      </p>
    )
  }

  const timeZoneHint = `Horário de ${userTimeZone()}.`
  return (
    <form
      ref={formRef}
      aria-label="Novo evento"
      noValidate
      onSubmit={(event) => void save(event)}
      className="flex flex-col gap-6"
    >
      {shown !== null && <AdminNoticeMessage key={shown.id} notice={shown.notice} takesFocus={shown.takesFocus} />}
      <FormField label="Título" hint={`Uma linha, até ${TITLE_MAX_LENGTH} caracteres.`} problem={messageOf('title', problems)}>
        {(control) => (
          <input
            {...control}
            name="title"
            type="text"
            autoComplete="off"
            value={values.title}
            onChange={(event) => edit('title', event.currentTarget.value)}
            className={FIELD_CONTROL}
          />
        )}
      </FormField>
      <FormField
        label="Descrição"
        hint={`Até ${DESCRIPTION_MAX_LENGTH} caracteres. Separe os parágrafos com uma linha em branco.`}
        problem={messageOf('description', problems)}
      >
        {(control) => (
          <textarea
            {...control}
            name="description"
            rows={5}
            value={values.description}
            onChange={(event) => edit('description', event.currentTarget.value)}
            className={`${FIELD_CONTROL} py-3`}
          />
        )}
      </FormField>
      <FormField
        label="Início"
        hint={`${timeZoneHint} No futuro e em até ${MAX_DAYS_AHEAD} dias.`}
        problem={messageOf('startsAt', problems)}
      >
        {(control) => (
          <input
            {...control}
            name="startsAt"
            type="datetime-local"
            value={values.startsAt}
            onChange={(event) => edit('startsAt', event.currentTarget.value)}
            className={FIELD_CONTROL}
          />
        )}
      </FormField>
      <FormField
        label="Fim"
        hint={`${timeZoneHint} Depois do início e em até ${MAX_DURATION_HOURS} horas dele.`}
        problem={messageOf('endsAt', problems)}
      >
        {(control) => (
          <input
            {...control}
            name="endsAt"
            type="datetime-local"
            value={values.endsAt}
            onChange={(event) => edit('endsAt', event.currentTarget.value)}
            className={FIELD_CONTROL}
          />
        )}
      </FormField>
      <FormField label="Capacidade" hint={`De ${MIN_CAPACITY} a ${MAX_CAPACITY} pessoas.`} problem={messageOf('capacity', problems)}>
        {(control) => (
          <input
            {...control}
            name="capacity"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={values.capacity}
            onChange={(event) => edit('capacity', event.currentTarget.value)}
            className={FIELD_CONTROL}
          />
        )}
      </FormField>
      <div className="flex flex-col items-start gap-3">
        <button type="submit" disabled={isSaving} className={PRIMARY_BUTTON}>
          {isSaving ? 'Criando…' : 'Criar rascunho'}
        </button>
        <p className="text-sm text-fg-muted">O rascunho só aparece para a equipe até ser publicado.</p>
      </div>
    </form>
  )
}

function messageOf(field: EventField, problems: EventFieldProblems): string | null {
  const problem = problems[field]
  return problem === undefined ? null : problemMessage(field, problem)
}
