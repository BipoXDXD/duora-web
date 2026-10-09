import { describe, expect, it } from 'vitest'
import { INITIAL_REPORT_FORM, NO_PROBLEMS, reportFormReducer, type ReportFormState } from './reportFormState.ts'

const WITH_PROBLEMS: ReportFormState = {
  ...INITIAL_REPORT_FORM,
  reason: 'OTHER',
  description: 'texto',
  problems: { reason: 'rejected', description: 'tooLong' },
}

describe('reportFormReducer', () => {
  it('starts with nothing filled, no problem, no refusal and nothing being sent', () => {
    expect(INITIAL_REPORT_FORM).toEqual({
      reason: null,
      description: '',
      alsoBlock: false,
      problems: { reason: null, description: null },
      refusal: null,
      isSending: false,
    })
  })

  it('clears both problems when the reason is chosen, because a required description depends on it', () => {
    const next = reportFormReducer(WITH_PROBLEMS, { type: 'reasonChosen', reason: 'HARASSMENT' })

    expect(next.reason).toBe('HARASSMENT')
    expect(next.problems).toEqual(NO_PROBLEMS)
    expect(next.description).toBe('texto')
  })

  it('clears only the description problem when the description is typed', () => {
    const next = reportFormReducer(WITH_PROBLEMS, { type: 'descriptionTyped', description: 'curto' })

    expect(next.description).toBe('curto')
    expect(next.problems).toEqual({ reason: 'rejected', description: null })
  })

  it('toggles whether to block the person as well', () => {
    const blocking = reportFormReducer(INITIAL_REPORT_FORM, { type: 'blockToggled' })
    const notBlocking = reportFormReducer(blocking, { type: 'blockToggled' })

    expect(blocking.alsoBlock).toBe(true)
    expect(notBlocking.alsoBlock).toBe(false)
  })

  it('shows the field problems, drops an earlier refusal and stops sending', () => {
    const refused: ReportFormState = { ...INITIAL_REPORT_FORM, refusal: { kind: 'failed' }, isSending: true }

    const next = reportFormReducer(refused, {
      type: 'fieldsRefused',
      problems: { reason: 'required', description: null },
    })

    expect(next).toEqual({
      ...INITIAL_REPORT_FORM,
      problems: { reason: 'required', description: null },
      refusal: null,
      isSending: false,
    })
  })

  it('starts sending with no problem and no refusal left over from the last try', () => {
    const next = reportFormReducer(
      { ...WITH_PROBLEMS, refusal: { kind: 'unavailable' } },
      { type: 'sendStarted' },
    )

    expect(next.isSending).toBe(true)
    expect(next.problems).toEqual(NO_PROBLEMS)
    expect(next.refusal).toBeNull()
    expect(next.reason).toBe('OTHER')
  })

  it('keeps what was filled in when the whole report is refused, and stops sending', () => {
    const sending = reportFormReducer(WITH_PROBLEMS, { type: 'sendStarted' })

    const next = reportFormReducer(sending, {
      type: 'reportRefused',
      refusal: { kind: 'quotaExhausted', retryAfterSeconds: 90 },
    })

    expect(next.refusal).toEqual({ kind: 'quotaExhausted', retryAfterSeconds: 90 })
    expect(next.isSending).toBe(false)
    expect(next.description).toBe('texto')
  })
})
