import { ProfilePage } from './pages/ProfilePage.ts'
import { expectUsableLayout } from './support/checks.ts'
import { aSession } from './support/data.ts'
import { json } from './support/fakeApi.ts'
import { expect, test } from './support/fixtures.ts'
import { ProfileServer } from './support/profileServer.ts'

const PROFILE_PATH = '/api/me/profile'

test.describe('Edição do perfil', () => {
  test('editar sobre uma versão desatualizada (412) recarrega, mantém o que foi digitado e permite salvar de novo', async ({
    page,
    api,
  }) => {
    api.on('GET', '/api/me', json(200, aSession()))
    const server = new ProfileServer(api)
    const profile = await new ProfilePage(page).open()
    await expect(profile.detail('Nome')).toHaveText('Ana Souza')
    await expect(profile.detail('Estado')).toHaveText('São Paulo')
    await expectUsableLayout(page)

    await profile.startEditing()
    await expect(profile.name()).toBeFocused()
    await profile.name().fill('Ana S.')
    // Em outra aba, o estado e a apresentação mudaram depois da leitura desta tela.
    server.changeElsewhere({ region: 'BR-RJ', bio: 'Me mudei para o Rio.' })
    await profile.saveButton().click()

    await expect(profile.alert('Seu perfil mudou em outro lugar.')).toBeVisible()
    await expect(profile.name()).toHaveValue('Ana S.')
    await expect(profile.region()).toHaveValue('BR-RJ')
    await expect(profile.bio()).toHaveValue('Me mudei para o Rio.')
    await expectUsableLayout(page)

    await profile.saveButton().click()

    await expect(profile.savedNotice()).toBeFocused()
    await expect(profile.detail('Nome')).toHaveText('Ana S.')
    await expect(profile.detail('Estado')).toHaveText('Rio de Janeiro')
    await expect(profile.detail('Apresentação')).toHaveText('Me mudei para o Rio.')
    const patches = api.callsTo('PATCH', PROFILE_PATH)
    // A primeira tentativa levou a versão antiga; a segunda, a nova, e só com o campo que a pessoa mudou.
    expect(patches.map((patch) => patch.headers['if-match'])).toEqual(['"v1"', '"v2"'])
    expect(patches.map((patch) => patch.body)).toEqual([{ displayName: 'Ana S.' }, { displayName: 'Ana S.' }])
    expect(server.profile.displayName).toBe('Ana S.')
    await expectUsableLayout(page)
  })
})
