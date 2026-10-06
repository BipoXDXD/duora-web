import { useState } from 'react'

interface BackdropImageProps {
  /** Versão 16:9 (1920×1080), usada a partir do breakpoint de desktop. */
  readonly wideSrc: string
  /** Versão retrato (1080×1350) para o celular. Sem ela, a larga serve em todo tamanho. */
  readonly narrowSrc?: string
  /** O hero carrega cedo e com prioridade (é o LCP); o resto espera a rolagem. */
  readonly isAboveTheFold: boolean
  /** Posição do recorte (`object-*`), para manter o assunto da foto à vista em cada proporção. */
  readonly className?: string
}

/** Mesmo limite do `useIsDesktop`: 48rem. */
const DESKTOP_MEDIA = '(min-width: 48rem)'

/**
 * Foto decorativa que cobre o contêiner (que precisa de `relative`). Fica atrás do conteúdo e do overlay;
 * se o arquivo faltar ou falhar, ela some e aparece o gradiente do próprio contêiner.
 */
export function BackdropImage({ wideSrc, narrowSrc, isAboveTheFold, className = '' }: BackdropImageProps) {
  const [hasFailed, setHasFailed] = useState(false)
  if (hasFailed) {
    return null
  }

  return (
    <picture>
      {narrowSrc !== undefined && <source media={DESKTOP_MEDIA} srcSet={wideSrc} type="image/webp" />}
      <img
        src={narrowSrc ?? wideSrc}
        alt=""
        loading={isAboveTheFold ? 'eager' : 'lazy'}
        fetchPriority={isAboveTheFold ? 'high' : 'auto'}
        decoding="async"
        onError={() => setHasFailed(true)}
        className={`absolute inset-0 size-full object-cover ${className}`}
      />
    </picture>
  )
}
