import { Logo } from '../../shared/brand/Logo.tsx'
import { CONTAINER } from './sectionStyles.ts'

export function SiteFooter() {
  return (
    <footer className="border-t border-divider">
      <div className={`${CONTAINER} flex flex-col gap-4 py-12 md:flex-row md:items-center md:justify-between`}>
        <Logo className="h-6 w-auto self-start text-fg md:self-auto" />
        <p className="text-sm text-fg-muted">Encontros que começam por um jogo.</p>
      </div>
    </footer>
  )
}
