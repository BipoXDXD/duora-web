import { afterEach, describe, expect, it } from 'vitest'
import { navigateTo } from './navigateTo.ts'

afterEach(() => {
  window.location.hash = ''
})

describe('navigateTo', () => {
  /** O jsdom só navega por âncora; é o bastante para ver que a página foi para a URL. */
  it('takes the page to the URL', () => {
    navigateTo(`${window.location.origin}/#signed-out`)

    expect(window.location.hash).toBe('#signed-out')
  })
})
