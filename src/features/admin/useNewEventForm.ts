import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { goTo } from '../../shared/routing/history.ts'
import { adminEventPath } from '../../shared/routing/routes.ts'
import { focusFirstProblem } from '../../shared/ui/focusFirstProblem.ts'
import { errorNotice } from '../../shared/ui/notice.ts'
import { useShownNotice } from '../../shared/ui/useShownNotice.ts'
import { eventProblemsFromApi } from './adminEventApiProblems.ts'
import {
  checkEventForm,
  EMPTY_EVENT_FORM,
  EVENT_FIELDS,
  type EventField,
  type EventFieldProblems,
  type EventFormValues,
} from './adminEventForm.ts'
import { createEvent, type CreateEventResult } from './adminEvents.ts'
import { noticeOfCreateFailure, type AdminNotice } from './adminNotices.ts'
import { ADMIN_KEYS } from './adminQueries.ts'

const REJECTED_FORM_TEXT = 'Confira os dados do evento e tente de novo.'

/**
 * O rascunho do formulário de evento e o que acontece ao enviar: confere os campos, cria o evento e, se a API
 * recusar, mostra o problema no campo certo. O formulário só desenha o que isto devolve.
 */
export function useNewEventForm() {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<EventFormValues>(EMPTY_EVENT_FORM)
  const [problems, setProblems] = useState<EventFieldProblems>({})
  const { shown, show: showNotice, hide: hideNotice } = useShownNotice<{ readonly notice: AdminNotice; readonly takesFocus: boolean }>()
  const [isForbidden, setIsForbidden] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  function showProblems(found: EventFieldProblems) {
    setProblems(found)
    focusFirstProblem(formRef.current, EVENT_FIELDS, found)
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

  return { formRef, values, problems, shown, isForbidden, isSaving, edit, save }
}

/** O instante em que a pessoa envia o formulário; as regras de data valem para ele. */
function currentInstant(): Date {
  return new Date()
}
