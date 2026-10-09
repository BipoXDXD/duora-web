import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useShownNotice } from './useShownNotice.ts'

describe('useShownNotice', () => {
  it('starts with nothing shown', () => {
    const { result } = renderHook(() => useShownNotice<{ readonly text: string }>())

    expect(result.current.shown).toBeNull()
  })

  it('gives each notice a new id, so the same text shown twice is a new element and is announced again', () => {
    const { result } = renderHook(() => useShownNotice<{ readonly text: string }>())

    act(() => result.current.show({ text: 'Tente de novo.' }))
    const first = result.current.shown
    act(() => result.current.show({ text: 'Tente de novo.' }))

    expect(first).toEqual({ text: 'Tente de novo.', id: 1 })
    expect(result.current.shown).toEqual({ text: 'Tente de novo.', id: 2 })
  })

  it('hides the notice', () => {
    const { result } = renderHook(() => useShownNotice<{ readonly text: string }>())
    act(() => result.current.show({ text: 'Salvo.' }))

    act(() => result.current.hide())

    expect(result.current.shown).toBeNull()
  })

})
