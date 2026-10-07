import type { ReactNode } from 'react'
import { useFocusOnMount } from './useFocusOnMount.ts'

interface PageFrameProps {
  readonly title: string
  readonly children: ReactNode
}

/**
 * Moldura das páginas do app fora da landing: coluna de leitura e o título em foco ao abrir, para quem usa
 * leitor de tela saber que a página mudou.
 */
export function PageFrame({ title, children }: PageFrameProps) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>()
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 md:px-8 md:py-16">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-4xl leading-tight font-medium tracking-tight text-balance text-fg"
      >
        {title}
      </h1>
      <div className="mt-8 flex flex-col gap-12">{children}</div>
    </div>
  )
}
