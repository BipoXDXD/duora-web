import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { isApiFailure } from '../../shared/api/http.ts'
import { FormField } from '../../shared/ui/FormField.tsx'
import { FIELD_CONTROL, PRIMARY_BUTTON, SECONDARY_BUTTON, TEXT_LINK } from '../../shared/ui/styles.ts'
import { useFocusOnMount } from '../../shared/ui/useFocusOnMount.ts'
import { LOGIN_URL } from '../auth/loginUrl.ts'
import {
  editProfile,
  isRegion,
  PROFILE_FIELDS,
  REGION_CODES,
  REGION_NAMES,
  type EditProfileResult,
  type ProfileField,
  type Region,
  type VersionedProfile,
} from './profile.ts'
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
import { formatBirthDate, problemMessage } from './profileText.ts'

interface ProfileFormProps {
  readonly initial: VersionedProfile
  readonly onSaved: () => void
  readonly onCancel: () => void
}

/** O aviso do formulário inteiro; os problemas de um campo ficam no próprio campo. */
type FormNotice = 'unchanged' | 'outdated' | 'birthDateLocked' | 'rejected' | 'signedOut' | 'failed'

/** Os estados pelo nome, na ordem alfabética do português. */
const REGIONS_BY_NAME = REGION_CODES.toSorted((a, b) => REGION_NAMES[a].localeCompare(REGION_NAMES[b], 'pt-BR'))

export function ProfileForm({ initial, onSaved, onCancel }: ProfileFormProps) {
  const queryClient = useQueryClient()
  const [baseline, setBaseline] = useState(initial)
  const [values, setValues] = useState(() => formValuesOf(initial.profile))
  const [problems, setProblems] = useState<FieldProblems>({})
  const [notice, setNotice] = useState<FormNotice | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const nameRef = useFocusOnMount<HTMLInputElement>()

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
    const first = PROFILE_FIELDS.find((field) => found[field] !== undefined)
    const control = first === undefined ? null : formRef.current?.elements.namedItem(first)
    if (control instanceof HTMLElement) {
      control.focus()
    }
  }

  function edit<K extends keyof ProfileFormValues>(field: K, value: ProfileFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  const lockedBirthDate = baseline.profile.birthDate
  return (
    <form
      ref={formRef}
      aria-label="Editar perfil"
      noValidate
      onSubmit={(event) => void save(event)}
      className="flex flex-col gap-6"
    >
      <FormNoticeMessage notice={notice} />
      <FormField label="Nome" hint="É como as outras pessoas veem você." problem={messageOf('displayName', problems)}>
        {(control) => (
          <input
            {...control}
            ref={nameRef}
            name="displayName"
            type="text"
            autoComplete="nickname"
            value={values.displayName}
            onChange={(event) => edit('displayName', event.currentTarget.value)}
            className={FIELD_CONTROL}
          />
        )}
      </FormField>
      {lockedBirthDate === null ? (
        <FormField
          label="Data de nascimento"
          hint="O Duora é para maiores de 18 anos. Depois de salva, a data não muda."
          problem={messageOf('birthDate', problems)}
        >
          {(control) => (
            <input
              {...control}
              name="birthDate"
              type="date"
              autoComplete="bday"
              value={values.birthDate}
              onChange={(event) => edit('birthDate', event.currentTarget.value)}
              className={FIELD_CONTROL}
            />
          )}
        </FormField>
      ) : (
        <LockedBirthDate birthDate={lockedBirthDate} />
      )}
      <FormField label="Estado" hint="Só o estado, nunca a cidade ou o endereço." problem={messageOf('region', problems)}>
        {(control) => (
          <select
            {...control}
            name="region"
            value={values.region}
            onChange={(event) => edit('region', regionOf(event.currentTarget.value))}
            className={FIELD_CONTROL}
          >
            {baseline.profile.region === null && <option value="">Escolha seu estado</option>}
            {REGIONS_BY_NAME.map((code) => (
              <option key={code} value={code}>
                {REGION_NAMES[code]}
              </option>
            ))}
          </select>
        )}
      </FormField>
      <FormField label="Apresentação" hint="Opcional. Até 300 caracteres." problem={messageOf('bio', problems)}>
        {(control) => (
          <textarea
            {...control}
            name="bio"
            rows={4}
            value={values.bio}
            onChange={(event) => edit('bio', event.currentTarget.value)}
            className={`${FIELD_CONTROL} py-3`}
          />
        )}
      </FormField>
      <div className="flex flex-wrap gap-4">
        <button type="submit" disabled={isSaving} className={PRIMARY_BUTTON}>
          {isSaving ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" onClick={onCancel} className={SECONDARY_BUTTON}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

function messageOf(field: ProfileField, problems: FieldProblems): string | null {
  const problem = problems[field]
  return problem === undefined ? null : problemMessage(field, problem)
}

/** O `<select>` só oferece as regiões e, no perfil sem estado, a opção vazia. */
function regionOf(value: string): Region | '' {
  return isRegion(value) ? value : ''
}

function LockedBirthDate({ birthDate }: { readonly birthDate: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-semibold text-fg">Data de nascimento</p>
      <p className="text-fg">{formatBirthDate(birthDate)}</p>
      <p className="text-sm text-fg-muted">Informada uma vez, ela não muda.</p>
    </div>
  )
}

const NOTICE_TEXT: Readonly<Record<Exclude<FormNotice, 'signedOut'>, string>> = {
  unchanged: 'Nenhuma alteração para salvar.',
  outdated:
    'Seu perfil mudou em outro lugar. Carregamos a versão mais recente e mantivemos o que você digitou. Confira e salve de novo.',
  birthDateLocked: 'A data de nascimento já tinha sido informada e não muda mais. Confira e salve de novo.',
  rejected: 'Confira os dados do perfil e tente de novo.',
  failed: 'Não foi possível salvar agora. Tente de novo.',
}

function FormNoticeMessage({ notice }: { readonly notice: FormNotice | null }) {
  if (notice === null) {
    return null
  }
  if (notice === 'unchanged') {
    return (
      <p role="status" className="text-fg-muted">
        {NOTICE_TEXT.unchanged}
      </p>
    )
  }
  return (
    <div role="alert" className="flex flex-col items-start gap-2 font-semibold text-danger">
      {notice === 'signedOut' ? (
        <>
          <p>Sua sessão expirou. Entre de novo para salvar.</p>
          <a href={LOGIN_URL} className={TEXT_LINK}>
            Entrar
          </a>
        </>
      ) : (
        <p>{NOTICE_TEXT[notice]}</p>
      )}
    </div>
  )
}
