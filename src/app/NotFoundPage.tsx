import { AppLink } from '../shared/routing/AppLink.tsx'
import { PATHS } from '../shared/routing/routes.ts'
import { PageFrame } from '../shared/ui/PageFrame.tsx'
import { PRIMARY_BUTTON } from '../shared/ui/styles.ts'

export function NotFoundPage() {
  return (
    <PageFrame title="Página não encontrada">
      <div className="flex flex-col items-start gap-4">
        <p className="text-lg text-fg-muted">O endereço não existe ou mudou.</p>
        <AppLink to={PATHS.home} className={PRIMARY_BUTTON}>
          Voltar ao início
        </AppLink>
      </div>
    </PageFrame>
  )
}
