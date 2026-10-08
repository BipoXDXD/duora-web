import type { ReactNode } from 'react'
import { useFocusOnMount } from './useFocusOnMount.ts'

interface PageFrameProps {
  readonly title: string
  readonly children: ReactNode
}

/**
 * Moldura das páginas do app fora da landing: coluna de leitura e o título em foco ao abrir, para quem usa
 * leitor de tela saber que a página mudou. O título não é um controle e o foco vem do código, não do
 * teclado: sem o anel (que o Chromium desenharia em volta da coluna inteira ao abrir a página).
 */
export function PageFrame({ title, children }: PageFrameProps) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>()
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 md:px-8 md:py-16">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-3xl leading-tight md:text-4xl font-medium tracking-tight text-balance text-fg focus-visible:outline-hidden"
      >
        {title}
      </h1>
      <div className="mt-8 flex flex-col gap-12">{children}</div>
    </div>
  )
}
