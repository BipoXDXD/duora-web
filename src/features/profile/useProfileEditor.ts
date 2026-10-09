import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { isApiFailure } from '../../shared/api/http.ts'
import { focusFirstProblem } from '../../shared/ui/focusFirstProblem.ts'
import { editProfile, PROFILE_FIELDS, type EditProfileResult, type VersionedProfile } from './profile.ts'
import {
  checkProfileForm,
  formValuesOf,
  rebaseFormValues,
  todayIsoDate,
  type FieldProblems,
  type ProfileFormValues,
} from './profileForm.ts'
import { problemsFromApi } from './profileApiProblems.ts'
import { PROFILE_QUERY } from './profileQuery.ts'

/** O aviso do formulário inteiro; os problemas de um campo ficam no próprio campo. */
export type FormNotice = 'unchanged' | 'outdated' | 'birthDateLocked' | 'rejected' | 'signedOut' | 'failed'

/**
 * O rascunho do perfil e o que acontece ao salvar: confere o que mudou, manda só isso e, se o perfil mudou em
 * outro lugar, lê a versão nova e reaplica o que a pessoa digitou. O formulário só desenha o que isto devolve.
 */
export function useProfileEditor(initial: VersionedProfile, onSaved: () => void) {
  const queryClient = useQueryClient()
  const [baseline, setBaseline] = useState(initial)
  const [values, setValues] = useState(() => formValuesOf(initial.profile))
  const [problems, setProblems] = useState<FieldProblems>({})
  const [notice, setNotice] = useState<FormNotice | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice(null)
    const check = checkProfileForm(values, baseline.profile, todayIsoDate())
    switch (check.kind) {
      case 'unchanged':
        setProblems({})
        setNotice('unchanged')
        return
      case 'invalid':
        showProblems(check.problems)
        return
      case 'changed':
        setProblems({})
        setIsSaving(true)
        await apply(await editProfile(baseline.etag, check.changes))
        setIsSaving(false)
    }
  }

  async function apply(result: EditProfileResult) {
    switch (result.kind) {
      case 'saved':
        queryClient.setQueryData(PROFILE_QUERY.queryKey, result.saved)
        onSaved()
        return
      case 'outdated':
      case 'birthDateLocked':
        await reloadKeepingEdits(result.kind)
        return
      case 'invalid': {
        const { problems: refused, hasUnplacedProblem } = problemsFromApi(result.fieldErrors)
        showProblems(refused)
        if (hasUnplacedProblem) {
          setNotice('rejected')
        }
        return
      }
      case 'signedOut':
      case 'failed':
        setNotice(result.kind)
    }
  }

  /** O perfil mudou desde a leitura: lê de novo e reaplica o que a pessoa digitou sobre a versão nova. */
  async function reloadKeepingEdits(reason: 'outdated' | 'birthDateLocked') {
    try {
      const fresh = await queryClient.fetchQuery({ ...PROFILE_QUERY, staleTime: 0 })
      setValues((typed) => rebaseFormValues(typed, baseline.profile, fresh.profile))
      setBaseline(fresh)
      setNotice(reason)
    } catch (error) {
      if (!isApiFailure(error)) {
        throw error
      }
      setNotice('failed')
    }
  }

  function showProblems(found: FieldProblems) {
    setProblems(found)
    focusFirstProblem(formRef.current, PROFILE_FIELDS, found)
  }

  function edit<K extends keyof ProfileFormValues>(field: K, value: ProfileFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  return { formRef, baseline: baseline.profile, values, problems, notice, isSaving, edit, save }
}
