import type { AdminPhase } from './adminEvents.ts'
import { ADMIN_PHASE_LABELS } from './adminText.ts'

/** A fase do evento para a equipe, sempre em texto: o rascunho e o publicado que ainda vai começar também têm etiqueta. */
export function AdminPhaseBadge({ phase }: { readonly phase: AdminPhase }) {
  return (
    <span className="rounded-full border border-edge px-3 py-1 text-sm font-semibold tracking-wide text-fg">
      {ADMIN_PHASE_LABELS[phase]}
    </span>
  )
}
