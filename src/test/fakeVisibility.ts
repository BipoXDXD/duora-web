import { act } from '@testing-library/react'
import { vi } from 'vitest'

let visibility: DocumentVisibilityState = 'visible'

/** Para o `beforeEach`: a aba começa visível, e o `document` passa a responder o que o teste mandar. */
export function stubVisibility() {
  visibility = 'visible'
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
}

/** A aba já está escondida quando a tela aparece: muda o estado sem avisar ninguém. */
export function startHidden() {
  visibility = 'hidden'
}

/** A pessoa troca de aba: muda o estado e avisa com `visibilitychange`, como o navegador. */
export function setVisibility(state: DocumentVisibilityState) {
  visibility = state
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}
