import { FormField } from '../../shared/ui/FormField.tsx'
import { FIELD_CONTROL, PRIMARY_BUTTON, SECONDARY_BUTTON, TEXT_LINK } from '../../shared/ui/styles.ts'
import { useFocusOnMount } from '../../shared/ui/useFocusOnMount.ts'
import { LOGIN_URL } from '../auth/loginUrl.ts'
import { isRegion, REGION_CODES, REGION_NAMES, type ProfileField, type Region, type VersionedProfile } from './profile.ts'
import { BIO_MAX_LENGTH, type FieldProblems } from './profileForm.ts'
import { formatBirthDate, problemMessage } from './profileText.ts'
import { useProfileEditor, type FormNotice } from './useProfileEditor.ts'

interface ProfileFormProps {
  readonly initial: VersionedProfile
  readonly onSaved: () => void
  readonly onCancel: () => void
}

export function ProfileForm({ initial, onSaved, onCancel }: ProfileFormProps) {
  const { formRef, baseline, values, problems, notice, isSaving, edit, save } = useProfileEditor(initial, onSaved)
  const nameRef = useFocusOnMount<HTMLInputElement>()

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
      <BirthDateField
        lockedTo={baseline.birthDate}
        value={values.birthDate}
        problem={messageOf('birthDate', problems)}
        onChange={(value) => edit('birthDate', value)}
      />
      <RegionField
        value={values.region}
        offersEmptyChoice={baseline.region === null}
        problem={messageOf('region', problems)}
        onChange={(value) => edit('region', value)}
      />
      <FormField label="Apresentação" hint={`Opcional. Até ${BIO_MAX_LENGTH} caracteres.`} problem={messageOf('bio', problems)}>
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

interface BirthDateFieldProps {
  /** A data já gravada, que não muda mais; `null` enquanto a pessoa ainda não a informou. */
  readonly lockedTo: string | null
  readonly value: string
  readonly problem: string | null
  readonly onChange: (value: string) => void
}

function BirthDateField({ lockedTo, value, problem, onChange }: BirthDateFieldProps) {
  if (lockedTo !== null) {
    return <LockedBirthDate birthDate={lockedTo} />
  }
  return (
    <FormField
      label="Data de nascimento"
      hint="O Duora é para maiores de 18 anos. Depois de salva, a data não muda."
      problem={problem}
    >
      {(control) => (
        <input
          {...control}
          name="birthDate"
          type="date"
          autoComplete="bday"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          className={FIELD_CONTROL}
        />
      )}
    </FormField>
  )
}

/** Os estados pelo nome, na ordem alfabética do português. */
const REGIONS_BY_NAME = REGION_CODES.toSorted((a, b) => REGION_NAMES[a].localeCompare(REGION_NAMES[b], 'pt-BR'))

interface RegionFieldProps {
  readonly value: Region | ''
  /** O perfil ainda não tem estado: a lista abre com "Escolha seu estado". */
  readonly offersEmptyChoice: boolean
  readonly problem: string | null
  readonly onChange: (value: Region | '') => void
}

function RegionField({ value, offersEmptyChoice, problem, onChange }: RegionFieldProps) {
  return (
    <FormField label="Estado" hint="Só o estado, nunca a cidade ou o endereço." problem={problem}>
      {(control) => (
        <select
          {...control}
          name="region"
          value={value}
          onChange={(event) => onChange(regionOf(event.currentTarget.value))}
          className={FIELD_CONTROL}
        >
          {offersEmptyChoice && <option value="">Escolha seu estado</option>}
          {REGIONS_BY_NAME.map((code) => (
            <option key={code} value={code}>
              {REGION_NAMES[code]}
            </option>
          ))}
        </select>
      )}
    </FormField>
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
