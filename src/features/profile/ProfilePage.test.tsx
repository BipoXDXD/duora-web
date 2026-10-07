import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../../app/App.tsx'
import {
  ANONYMOUS_SESSION,
  byMethod,
  inSequence,
  jsonAnswer,
  networkFailure,
  neverAnswer,
  problemAnswer,
  stubApi,
  type FakeRoute,
} from '../../test/fakeApi.ts'
import { stubMatchMedia } from '../../test/fakeMatchMedia.ts'
import { elementsWithoutTouchTarget } from '../../test/touchTarget.ts'

const SESSION = { '/api/me': jsonAnswer({ displayName: 'Ana Souza', profileComplete: true }) }

const ANA = {
  displayName: 'Ana Souza',
  birthDate: '1990-05-10',
  bio: 'Gosto de jogos de cartas.',
  region: 'BR-SP',
  complete: true,
} as const
const EMPTY = { displayName: null, birthDate: null, bio: null, region: null, complete: false } as const

afterEach(() => {
  window.history.replaceState(null, '', '/')
  document.cookie = 'XSRF-TOKEN=; path=/; max-age=0'
})

function profileAnswer(profile: object, version: number): FakeRoute {
  return jsonAnswer(profile, 200, { ETag: `"${version}"` })
}

function renderProfilePage(profileRoute: FakeRoute, session: Readonly<Record<string, FakeRoute>> = SESSION) {
  stubMatchMedia(true)
  window.history.replaceState(null, '', '/perfil')
  const fetchMock = stubApi({ ...session, '/api/me/profile': profileRoute })
  render(<App />)
  return { fetchMock, user: userEvent.setup() }
}

function patchCalls(fetchMock: ReturnType<typeof stubApi>): RequestInit[] {
  return fetchMock.mock.calls.flatMap(([, init]) => (init?.method === 'PATCH' ? [init] : []))
}

function lastPatch(fetchMock: ReturnType<typeof stubApi>): { body: unknown; ifMatch: string | null } {
  const patch = patchCalls(fetchMock).at(-1)
  if (patch === undefined) {
    throw new Error('nenhum PATCH foi enviado')
  }
  return { body: JSON.parse(String(patch.body)), ifMatch: new Headers(patch.headers).get('If-Match') }
}

async function openEditor(user: ReturnType<typeof userEvent.setup>, buttonName = 'Editar perfil') {
  await user.click(await screen.findByRole('button', { name: buttonName }))
  return screen.getByRole('form', { name: 'Editar perfil' })
}

describe('profile page', () => {
  it('asks a visitor who is not logged in to sign in, without reading any profile', async () => {
    const { fetchMock } = renderProfilePage(neverAnswer(), ANONYMOUS_SESSION)

    expect(await screen.findByText('Entre para ver seu perfil.')).toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Entrar' })).toHaveAttribute(
      'href',
      '/oauth2/authorization/entra',
    )
    expect(fetchMock).not.toHaveBeenCalledWith('/api/me/profile', expect.anything())
  })

  it('offers to check the session again when it could not be checked', async () => {
    renderProfilePage(neverAnswer(), { '/api/me': networkFailure() })

    const main = screen.getByRole('main')
    expect(await within(main).findByText('Não foi possível verificar sua sessão.')).toBeInTheDocument()
    expect(within(main).getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  })

  it('says the session is being checked before showing anything', () => {
    renderProfilePage(neverAnswer(), { '/api/me': neverAnswer() })

    expect(within(screen.getByRole('main')).getByText('Um instante…')).toBeInTheDocument()
  })

  it('shows that the profile is loading', async () => {
    renderProfilePage(neverAnswer())

    expect(await screen.findByText('Carregando seu perfil…')).toBeInTheDocument()
  })

  it('puts the focus on the page title, so a screen reader starts there', async () => {
    renderProfilePage(neverAnswer())

    expect(await screen.findByRole('heading', { level: 1, name: 'Meu perfil' })).toHaveFocus()
  })

  it('offers to try again when the profile could not be read, and shows it on success', async () => {
    const { user } = renderProfilePage(inSequence(problemAnswer(500), profileAnswer(ANA, 4)))

    expect(await screen.findByText('Não foi possível carregar seu perfil.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(await screen.findByText('Gosto de jogos de cartas.')).toBeInTheDocument()
  })

  it('shows the profile with the birth date and the state written out', async () => {
    renderProfilePage(profileAnswer(ANA, 4))

    expect(await screen.findByText('Ana Souza', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByText('10 de maio de 1990')).toBeInTheDocument()
    expect(screen.getByText('São Paulo')).toBeInTheDocument()
    expect(screen.getByText('Gosto de jogos de cartas.')).toBeInTheDocument()
    expect(screen.queryByText(/Para usar o Duora/)).not.toBeInTheDocument()
  })

  it('invites to fill an empty profile', async () => {
    const { user } = renderProfilePage(profileAnswer(EMPTY, 0))

    expect(await screen.findByText('Seu perfil ainda está vazio.')).toBeInTheDocument()
    const form = await openEditor(user, 'Preencher perfil')

    expect(within(form).getByLabelText('Nome')).toHaveValue('')
  })

  it('says what is missing to use Duora while the profile is incomplete', async () => {
    renderProfilePage(profileAnswer({ ...ANA, region: null, complete: false }, 4))

    expect(await screen.findByText(/Para usar o Duora, informe nome, data de nascimento e estado/)).toBeInTheDocument()
    expect(screen.getAllByText('Não informado')).toHaveLength(1)
  })

  it('saves only what changed, with the version it read, and shows the saved profile', async () => {
    const saved = { ...ANA, bio: 'Gosto de xadrez.' }
    const { fetchMock, user } = renderProfilePage(byMethod({ GET: profileAnswer(ANA, 4), PATCH: profileAnswer(saved, 5) }))
    const form = await openEditor(user)

    await user.clear(within(form).getByLabelText('Apresentação'))
    await user.type(within(form).getByLabelText('Apresentação'), 'Gosto de xadrez.')
    await user.click(within(form).getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Perfil salvo.')
    expect(screen.getByText('Gosto de xadrez.')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Editar perfil' })).not.toBeInTheDocument()
    expect(lastPatch(fetchMock)).toEqual({ body: { bio: 'Gosto de xadrez.' }, ifMatch: '"4"' })
  })

  it('saves the state picked from the list', async () => {
    const { fetchMock, user } = renderProfilePage(
      byMethod({ GET: profileAnswer(ANA, 4), PATCH: profileAnswer({ ...ANA, region: 'BR-BA' }, 5) }),
    )
    const form = await openEditor(user)

    await user.selectOptions(within(form).getByLabelText('Estado'), 'Bahia')
    await user.click(within(form).getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Bahia')).toBeInTheDocument()
    expect(lastPatch(fetchMock).body).toEqual({ region: 'BR-BA' })
  })

  it('sends nothing when nothing changed', async () => {
    const { fetchMock, user } = renderProfilePage(profileAnswer(ANA, 4))
    const form = await openEditor(user)

    await user.click(within(form).getByRole('button', { name: 'Salvar' }))

    expect(screen.getByRole('status')).toHaveTextContent('Nenhuma alteração para salvar.')
    expect(patchCalls(fetchMock)).toEqual([])
  })

  it('goes back to the profile without sending anything on "Cancelar"', async () => {
    const { fetchMock, user } = renderProfilePage(profileAnswer(ANA, 4))
    const form = await openEditor(user)
    await user.type(within(form).getByLabelText('Nome'), ' Maria')

    await user.click(within(form).getByRole('button', { name: 'Cancelar' }))

    expect(screen.getByText('Ana Souza', { selector: 'dd' })).toBeInTheDocument()
    expect(patchCalls(fetchMock)).toEqual([])
  })

  it('points to the name field, without sending, when the name is erased', async () => {
    const { fetchMock, user } = renderProfilePage(profileAnswer(ANA, 4))
    const form = await openEditor(user)
    const name = within(form).getByLabelText('Nome')

    await user.clear(name)
    await user.click(within(form).getByRole('button', { name: 'Salvar' }))

    expect(name).toHaveAccessibleDescription(expect.stringContaining('Informe seu nome.'))
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(name).toHaveFocus()
    expect(patchCalls(fetchMock)).toEqual([])
  })

  it('refuses the birth date of someone under 18 on the field', async () => {
    const { user } = renderProfilePage(profileAnswer(EMPTY, 0))
    const form = await openEditor(user, 'Preencher perfil')
    const birthDate = within(form).getByLabelText('Data de nascimento')

    await user.type(birthDate, '2015-01-01')
    await user.click(within(form).getByRole('button', { name: 'Salvar' }))

    expect(birthDate).toHaveAccessibleDescription(expect.stringContaining('O Duora é só para maiores de 18 anos.'))
  })

  it('shows a birth date already given as text, since it cannot change', async () => {
    const { user } = renderProfilePage(profileAnswer(ANA, 4))
    const form = await openEditor(user)

    expect(within(form).queryByLabelText('Data de nascimento')).not.toBeInTheDocument()
    expect(within(form).getByText('10 de maio de 1990')).toBeInTheDocument()
  })

  it('offers every state, by name, and no empty choice once a state was given', async () => {
    const { user } = renderProfilePage(profileAnswer(ANA, 4))
    const form = await openEditor(user)
    const region = within(form).getByLabelText('Estado')

    expect(within(region).getAllByRole('option')).toHaveLength(27)
    expect(region).toHaveValue('BR-SP')
  })

  it('points a field the API refused to that field', async () => {
    const { user } = renderProfilePage(
      byMethod({ GET: profileAnswer(ANA, 4), PATCH: problemAnswer(400, 'bio contains a forbidden character') }),
    )
    const form = await openEditor(user)
    const bio = within(form).getByLabelText('Apresentação')

    await user.type(bio, ' Mais.')
    await user.click(within(form).getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(bio).toHaveAttribute('aria-invalid', 'true'))
    expect(bio).toHaveAccessibleDescription(expect.stringContaining('caracteres que não são aceitos'))
  })

  it('shows a refusal that names no field on the whole form', async () => {
    const { user } = renderProfilePage(byMethod({ GET: profileAnswer(ANA, 4), PATCH: problemAnswer(400) }))
    const form = await openEditor(user)

    await user.type(within(form).getByLabelText('Apresentação'), ' Mais.')
    await user.click(within(form).getByRole('button', { name: 'Salvar' }))

    expect(await within(form).findByRole('alert')).toHaveTextContent('Confira os dados do perfil e tente de novo.')
  })

  it('reloads the profile changed elsewhere, keeps what the user typed and saves on the new version', async () => {
    const elsewhere = { ...ANA, displayName: 'Ana (outra aba)' }
    const saved = { ...elsewhere, bio: 'Gosto de xadrez.' }
    const { fetchMock, user } = renderProfilePage(
      byMethod({
        GET: inSequence(profileAnswer(ANA, 4), profileAnswer(elsewhere, 7)),
        PATCH: inSequence(problemAnswer(412), profileAnswer(saved, 8)),
      }),
    )
    const form = await openEditor(user)
    const bio = within(form).getByLabelText('Apresentação')
    await user.clear(bio)
    await user.type(bio, 'Gosto de xadrez.')

    await user.click(within(form).getByRole('button', { name: 'Salvar' }))

    expect(await within(form).findByRole('alert')).toHaveTextContent(
      'Seu perfil mudou em outro lugar. Carregamos a versão mais recente e mantivemos o que você digitou. Confira e salve de novo.',
    )
    expect(within(form).getByLabelText('Nome')).toHaveValue('Ana (outra aba)')
    expect(bio).toHaveValue('Gosto de xadrez.')

    await user.click(within(form).getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Perfil salvo.')
    expect(lastPatch(fetchMock)).toEqual({ body: { bio: 'Gosto de xadrez.' }, ifMatch: '"7"' })
  })

  it('reloads the profile and explains when the birth date was already given elsewhere', async () => {
    const elsewhere = { ...EMPTY, birthDate: '1990-05-10' }
    const { user } = renderProfilePage(
      byMethod({ GET: inSequence(profileAnswer(EMPTY, 0), profileAnswer(elsewhere, 1)), PATCH: problemAnswer(409) }),
    )
    const form = await openEditor(user, 'Preencher perfil')

    await user.type(within(form).getByLabelText('Data de nascimento'), '1991-01-01')
    await user.click(within(form).getByRole('button', { name: 'Salvar' }))

    expect(await within(form).findByRole('alert')).toHaveTextContent(
      'A data de nascimento já tinha sido informada e não muda mais.',
    )
    expect(within(form).getByText('10 de maio de 1990')).toBeInTheDocument()
  })

  it('says the save failed when the profile changed elsewhere and could not be read again', async () => {
    const { user } = renderProfilePage(
      byMethod({ GET: inSequence(profileAnswer(ANA, 4), networkFailure()), PATCH: problemAnswer(412) }),
    )
    const form = await openEditor(user)
    const bio = within(form).getByLabelText('Apresentação')

    await user.type(bio, ' Mais.')
    await user.click(within(form).getByRole('button', { name: 'Salvar' }))

    expect(await within(form).findByRole('alert')).toHaveTextContent('Não foi possível salvar agora. Tente de novo.')
    expect(bio).toHaveValue('Gosto de jogos de cartas. Mais.')
  })

  it('asks to sign in again when the session expired while editing', async () => {
    const { user } = renderProfilePage(byMethod({ GET: profileAnswer(ANA, 4), PATCH: problemAnswer(401) }))
    const form = await openEditor(user)

    await user.type(within(form).getByLabelText('Apresentação'), ' Mais.')
    await user.click(within(form).getByRole('button', { name: 'Salvar' }))

    expect(await within(form).findByRole('alert')).toHaveTextContent('Sua sessão expirou. Entre de novo para salvar.')
    expect(within(form).getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/oauth2/authorization/entra')
  })

  it('keeps what was typed and offers to try again when the save failed', async () => {
    const { user } = renderProfilePage(byMethod({ GET: profileAnswer(ANA, 4), PATCH: networkFailure() }))
    const form = await openEditor(user)
    const bio = within(form).getByLabelText('Apresentação')

    await user.type(bio, ' Mais.')
    await user.click(within(form).getByRole('button', { name: 'Salvar' }))

    expect(await within(form).findByRole('alert')).toHaveTextContent('Não foi possível salvar agora. Tente de novo.')
    expect(bio).toHaveValue('Gosto de jogos de cartas. Mais.')
    expect(within(form).getByRole('button', { name: 'Salvar' })).toBeEnabled()
  })

  it('says it is saving and blocks a second submit meanwhile', async () => {
    const { user } = renderProfilePage(byMethod({ GET: profileAnswer(ANA, 4), PATCH: neverAnswer() }))
    const form = await openEditor(user)

    await user.type(within(form).getByLabelText('Apresentação'), ' Mais.')
    await user.click(within(form).getByRole('button', { name: 'Salvar' }))

    expect(within(form).getByRole('button', { name: 'Salvando…' })).toBeDisabled()
  })

  it('gives every link, button and field a 44px touch target', async () => {
    const { user } = renderProfilePage(profileAnswer(ANA, 4))
    await screen.findByText('Gosto de jogos de cartas.')
    expect(elementsWithoutTouchTarget(screen.getByRole('main'))).toEqual([])

    await openEditor(user)

    expect(elementsWithoutTouchTarget(screen.getByRole('main'))).toEqual([])
  })
})
