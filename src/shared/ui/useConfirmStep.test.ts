import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useConfirmStep } from './useConfirmStep.ts'

describe('useConfirmStep', () => {
  it('starts closed, with the focus claimed by no one', () => {
    const { result } = renderHook(() => useConfirmStep<'publish' | 'cancel'>())

    expect(result.current.confirming).toBeNull()
    expect(result.current.returnsFocus).toBe(false)
    expect(result.current.returnsFocusTo('publish')).toBe(false)
  })

  it('opens the step for the subject that was asked', () => {
    const { result } = renderHook(() => useConfirmStep<'publish' | 'cancel'>())

    act(() => result.current.ask('cancel'))

    expect(result.current.confirming).toEqual({ subject: 'cancel' })
    expect(result.current.returnsFocus).toBe(false)
  })

  it('gives the focus back to the subject that opened the step when the person backs out', () => {
    const { result } = renderHook(() => useConfirmStep<'publish' | 'cancel'>())
    act(() => result.current.ask('cancel'))

    act(() => result.current.back())

    expect(result.current.confirming).toBeNull()
    expect(result.current.returnsFocusTo('cancel')).toBe(true)
    expect(result.current.returnsFocusTo('publish')).toBe(false)
    expect(result.current.returnsFocus).toBe(true)
  })

  it('treats a falsy subject as a subject, not as the absence of one', () => {
    const { result } = renderHook(() => useConfirmStep<boolean>())
    act(() => result.current.ask(false))

    act(() => result.current.back())

    expect(result.current.returnsFocusTo(false)).toBe(true)
    expect(result.current.returnsFocusTo(true)).toBe(false)
  })

  it('claims no focus after the action finishes', () => {
    const { result } = renderHook(() => useConfirmStep<'publish' | 'cancel'>())
    act(() => result.current.ask('publish'))
    act(() => result.current.back())

    act(() => result.current.close())

    expect(result.current.confirming).toBeNull()
    expect(result.current.returnsFocus).toBe(false)
  })

  it('ignores a back with no step open', () => {
    const { result } = renderHook(() => useConfirmStep<'publish' | 'cancel'>())

    act(() => result.current.back())

    expect(result.current.returnsFocus).toBe(false)
  })

  it('forgets the focus of an earlier back when a new step opens', () => {
    const { result } = renderHook(() => useConfirmStep<'publish' | 'cancel'>())
    act(() => result.current.ask('publish'))
    act(() => result.current.back())

    act(() => result.current.ask('cancel'))

    expect(result.current.returnsFocus).toBe(false)
  })
})
