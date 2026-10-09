import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { goTo } from '../../shared/routing/history.ts'
import { adminEventPath } from '../../shared/routing/routes.ts'
import { FormField } from '../../shared/ui/FormField.tsx'
import { PageFrame } from '../../shared/ui/PageFrame.tsx'
import { errorNotice } from '../../shared/ui/notice.ts'
import { FIELD_CONTROL, PRIMARY_BUTTON } from '../../shared/ui/styles.ts'
import { useShownNotice } from '../../shared/ui/useShownNotice.ts'
import { RequireSession } from '../auth/RequireSession.tsx'
import { eventProblemsFromApi } from './adminEventApiProblems.ts'
import {
  checkEventForm,
  DESCRIPTION_MAX_LENGTH,
  EMPTY_EVENT_FORM,
  EVENT_FIELDS,
  MAX_CAPACITY,
  MAX_DAYS_AHEAD,
  MAX_DURATION_HOURS,
  MIN_CAPACITY,
  TITLE_MAX_LENGTH,
  userTimeZone,
  type EventField,
  type EventFieldProblems,
  type EventFormValues,
} from './adminEventForm.ts'
import { createEvent, type CreateEventResult } from './adminEvents.ts'
import { noticeOfCreateFailure, type AdminNotice } from './adminNotices.ts'
import { AdminNoticeMessage } from './AdminNoticeMessage.tsx'
import { ADMIN_KEYS } from './adminQueries.ts'
import { problemMessage, STAFF_ONLY_TEXT } from './adminText.ts'

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

const REJECTED_FORM_TEXT = 'Confira os dados do evento e tente de novo.'

function NewEventForm() {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<EventFormValues>(EMPTY_EVENT_FORM)
  const [problems, setProblems] = useState<EventFieldProblems>({})
  const { shown, show: showNotice, hide: hideNotice } = useShownNotice<{ readonly notice: AdminNotice; readonly takesFocus: boolean }>()
  const [isForbidden, setIsForbidden] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  function showProblems(found: EventFieldProblems) {
    setProblems(found)
    const first = EVENT_FIELDS.find((field) => found[field] !== undefined)
    const control = first === undefined ? null : formRef.current?.elements.namedItem(first)
    if (control instanceof HTMLElement) {
      control.focus()
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    hideNotice()
    const check = checkEventForm(values, currentInstant())
    if (check.kind === 'invalid') {
      showProblems(check.problems)
      return
    }
    setProblems({})
    setIsSaving(true)
    const result = await createEvent(check.event)
    setIsSaving(false)
    apply(result)
  }

  function apply(result: CreateEventResult) {
    switch (result.kind) {
      case 'created':
        queryClient.setQueryData(ADMIN_KEYS.event(result.event.id), { kind: 'found', event: result.event })
        void queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.lists })
        goTo(adminEventPath(result.event.id))
        return
      case 'invalid': {
        const { problems: refused, hasUnplacedProblem } = eventProblemsFromApi(result.fieldErrors)
        showProblems(refused)
        if (hasUnplacedProblem) {
          showNotice({ notice: errorNotice(REJECTED_FORM_TEXT), takesFocus: Object.keys(refused).length === 0 })
        }
        return
      }
      case 'forbidden':
        setIsForbidden(true)
        return
      default:
        showNotice({ notice: noticeOfCreateFailure(result.kind), takesFocus: true })
    }
  }

  function edit(field: EventField, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
  }

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

/** O instante em que a pessoa envia o formulário; as regras de data valem para ele. */
function currentInstant(): Date {
  return new Date()
}

function messageOf(field: EventField, problems: EventFieldProblems): string | null {
  const problem = problems[field]
  return problem === undefined ? null : problemMessage(field, problem)
}
