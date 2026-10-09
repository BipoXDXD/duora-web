import type { ReportReason } from './messageReport.ts'
import type { ReportProblems } from './reportForm.ts'

/** A recusa da denúncia inteira, fora dos campos. */
export type Refusal =
  | { readonly kind: 'rejected' | 'notFound' | 'unavailable' | 'signedOut' | 'failed' }
  | { readonly kind: 'quotaExhausted'; readonly retryAfterSeconds: number | null }

export const NO_PROBLEMS: ReportProblems = { reason: null, description: null }

/** Tudo o que o formulário de denúncia guarda: o que a pessoa preencheu e o que aconteceu no envio. */
export interface ReportFormState {
  /** `null` até a pessoa escolher um motivo. */
  readonly reason: ReportReason | null
  readonly description: string
  readonly alsoBlock: boolean
  readonly problems: ReportProblems
  readonly refusal: Refusal | null
  readonly isSending: boolean
}

export const INITIAL_REPORT_FORM: ReportFormState = {
  reason: null,
  description: '',
  alsoBlock: false,
  problems: NO_PROBLEMS,
  refusal: null,
  isSending: false,
}

export type ReportFormAction =
  | { readonly type: 'reasonChosen'; readonly reason: ReportReason }
  | { readonly type: 'descriptionTyped'; readonly description: string }
  | { readonly type: 'blockToggled' }
  /** O rascunho não passou na conferência local, ou a API recusou um campo. */
  | { readonly type: 'fieldsRefused'; readonly problems: ReportProblems }
  | { readonly type: 'sendStarted' }
  /** A API recusou a denúncia inteira. */
  | { readonly type: 'reportRefused'; readonly refusal: Refusal }

/**
 * Corrigir um campo apaga o problema dele (escolher o motivo apaga os dois, porque a descrição obrigatória
 * depende dele); cada novo envio apaga a recusa anterior.
 */
export function reportFormReducer(state: ReportFormState, action: ReportFormAction): ReportFormState {
  switch (action.type) {
    case 'reasonChosen':
      return { ...state, reason: action.reason, problems: NO_PROBLEMS }
    case 'descriptionTyped':
      return { ...state, description: action.description, problems: { ...state.problems, description: null } }
    case 'blockToggled':
      return { ...state, alsoBlock: !state.alsoBlock }
    case 'fieldsRefused':
      return { ...state, problems: action.problems, refusal: null, isSending: false }
    case 'sendStarted':
      return { ...state, problems: NO_PROBLEMS, refusal: null, isSending: true }
    case 'reportRefused':
      return { ...state, refusal: action.refusal, isSending: false }
  }
}
