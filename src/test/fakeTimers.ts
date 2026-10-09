import { act } from '@testing-library/react'
import { vi } from 'vitest'

/** Anda `ms` no relógio falso e deixa as promises e os renders assentarem. */
export async function wait(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms))
}
