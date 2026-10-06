import { BackdropImage } from '../../shared/ui/BackdropImage.tsx'

interface NightBackdropProps {
  readonly wideSrc: string
  readonly narrowSrc?: string
  readonly isAboveTheFold: boolean
  readonly imageClassName?: string
  /** Véu de ameixa sobre a foto, entre 40 e 70%, mais forte do lado do texto. */
  readonly scrimClassName: string
}

/**
 * Camadas de fundo das seções noturnas, de baixo para cima: o gradiente `candlelight` do contêiner, a foto,
 * o véu que garante o contraste do texto e o grão de filme. O contêiner precisa de `relative isolate`.
 */
export function NightBackdrop({
  wideSrc,
  narrowSrc,
  isAboveTheFold,
  imageClassName,
  scrimClassName,
}: NightBackdropProps) {
  return (
    <div aria-hidden="true" className="absolute inset-0 -z-10">
      <BackdropImage
        wideSrc={wideSrc}
        narrowSrc={narrowSrc}
        isAboveTheFold={isAboveTheFold}
        className={imageClassName}
      />
      <div className={`absolute inset-0 ${scrimClassName}`} />
      <div className="grain absolute inset-0" />
    </div>
  )
}
