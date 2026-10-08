import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { isBug } from '../../shared/api/http.ts'
import { AppLink } from '../../shared/routing/AppLink.tsx'
import { PATHS } from '../../shared/routing/routes.ts'
import { LoadFailure } from '../../shared/ui/LoadFailure.tsx'
import { PageFrame } from '../../shared/ui/PageFrame.tsx'
import { PRIMARY_BUTTON, SECONDARY_BUTTON, TEXT_LINK } from '../../shared/ui/styles.ts'
import { useFocusOnMount } from '../../shared/ui/useFocusOnMount.ts'
import { RequireSession } from '../auth/RequireSession.tsx'
import { REGION_NAMES, type Profile } from './profile.ts'
import { ProfileForm } from './ProfileForm.tsx'
import { PROFILE_QUERY } from './profileQuery.ts'
import { formatBirthDate } from './profileText.ts'

/** "Meu perfil": ver e editar o próprio perfil, e o caminho para as contas bloqueadas. */
export function ProfilePage() {
  return (
    <PageFrame title="Meu perfil">
      <RequireSession signInMessage="Entre para ver seu perfil.">
        <ProfileSection />
        <section aria-labelledby="privacy-title" className="flex flex-col items-start gap-2 border-t border-divider pt-8">
          <h2 id="privacy-title" className="text-xl font-semibold text-fg">
            Privacidade e segurança
          </h2>
          <AppLink to={PATHS.blockedAccounts} className={TEXT_LINK}>
            Contas bloqueadas
          </AppLink>
        </section>
      </RequireSession>
    </PageFrame>
  )
}

/** Depois de editar: salvo (anuncia e recebe o foco) ou cancelado (o foco volta para "Editar perfil"). */
type ReturnFromEditing = 'saved' | 'cancelled' | null

function ProfileSection() {
  const query = useQuery({ ...PROFILE_QUERY, retry: false, refetchOnWindowFocus: false, throwOnError: isBug })
  const [isEditing, setIsEditing] = useState(false)
  const [returned, setReturned] = useState<ReturnFromEditing>(null)

  if (query.data === undefined) {
    return query.isError ? (
      <LoadFailure message="Não foi possível carregar seu perfil." onRetry={() => void query.refetch()} />
    ) : (
      <p role="status" className="text-fg-muted">
        Carregando seu perfil…
      </p>
    )
  }
  if (isEditing) {
    return (
      <ProfileForm
        initial={query.data}
        onSaved={() => leaveEditor('saved')}
        onCancel={() => leaveEditor('cancelled')}
      />
    )
  }
  return <ProfileView profile={query.data.profile} returned={returned} onEdit={() => setIsEditing(true)} />

  function leaveEditor(how: Exclude<ReturnFromEditing, null>) {
    setReturned(how)
    setIsEditing(false)
  }
}

interface ProfileViewProps {
  readonly profile: Profile
  readonly returned: ReturnFromEditing
  readonly onEdit: () => void
}

function ProfileView({ profile, returned, onEdit }: ProfileViewProps) {
  if (isEmpty(profile)) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-lg font-semibold text-fg">Seu perfil ainda está vazio.</p>
        <p className="text-fg-muted">Preencha nome, data de nascimento e estado para começar a usar o Duora.</p>
        <EditButton label="Preencher perfil" className={PRIMARY_BUTTON} hasFocus={returned === 'cancelled'} onEdit={onEdit} />
      </div>
    )
  }
  return (
    <div className="flex flex-col items-start gap-6">
      {returned === 'saved' && <SavedNotice />}
      {!profile.complete && (
        <p className="text-fg-muted">Para usar o Duora, informe nome, data de nascimento e estado.</p>
      )}
      <dl className="grid w-full gap-6 sm:grid-cols-[max-content_1fr] sm:gap-x-8 sm:gap-y-4">
        <ProfileDetail term="Nome" value={profile.displayName} />
        <ProfileDetail
          term="Data de nascimento"
          value={profile.birthDate === null ? null : formatBirthDate(profile.birthDate)}
        />
        <ProfileDetail term="Estado" value={profile.region === null ? null : REGION_NAMES[profile.region]} />
        <ProfileDetail term="Apresentação" value={profile.bio} />
      </dl>
      <EditButton label="Editar perfil" className={SECONDARY_BUTTON} hasFocus={returned === 'cancelled'} onEdit={onEdit} />
    </div>
  )
}

function isEmpty(profile: Profile): boolean {
  return profile.displayName === null && profile.birthDate === null && profile.bio === null && profile.region === null
}

function SavedNotice() {
  const ref = useFocusOnMount<HTMLParagraphElement>()
  return (
    <p
      ref={ref}
      tabIndex={-1}
      role="status"
      className="w-full rounded-lg bg-primary-subtle p-4 font-semibold text-on-primary-subtle"
    >
      Perfil salvo.
    </p>
  )
}

interface EditButtonProps {
  readonly label: string
  readonly className: string
  readonly hasFocus: boolean
  readonly onEdit: () => void
}

function EditButton({ label, className, hasFocus, onEdit }: EditButtonProps) {
  const ref = useFocusOnMount<HTMLButtonElement>()
  return (
    <button ref={hasFocus ? ref : undefined} type="button" onClick={onEdit} className={className}>
      {label}
    </button>
  )
}

function ProfileDetail({ term, value }: { readonly term: string; readonly value: string | null }) {
  return (
    <div className="flex flex-col gap-1 sm:contents">
      <dt className="font-semibold text-fg-muted">{term}</dt>
      <dd className={value === null ? 'text-fg-muted' : 'whitespace-pre-line text-fg'}>{value ?? 'Não informado'}</dd>
    </div>
  )
}
