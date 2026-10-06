import { useId } from 'react'

/**
 * Letras de "duora" no Fraunces (peso 600, opsz 144, SOFT 50), convertidas em contorno para o logo não
 * depender da fonte carregada (OFL 1.1 permite). O "o" virou dois anéis que se cruzam em lente: duas
 * pessoas que se encontram. Coordenadas em unidades do viewBox; a linha de base é y = 0.
 */
const LETTERS =
  'M27.2-5.8 27-6.1V-51.8Q27-52.6 26.8-53Q26.6-53.3 26-53.4L24-53.5Q23.4-53.7 23.2-54Q23-54.2 23-54.7Q23-55.2 23.3-55.5Q23.6-55.8 24.3-56.1L33-58.8Q33.9-59.1 34.4-59.2Q34.9-59.4 35.4-59.4Q36-59.4 36.4-59Q36.8-58.5 36.8-57.8V-5.1Q36.8-4.1 37-3.6Q37.3-3.2 37.9-3L39.6-2.6Q40-2.4 40.3-2Q40.5-1.7 40.5-1.2Q40.5-0.6 40.1-0.3Q39.8 0 39.1 0H30.1Q28.9 0 28-0.8Q27.2-1.6 27.2-2.9ZM1.8-16.6Q1.8-22.7 4-27Q6.2-31.3 9.9-33.6Q13.7-35.9 18.4-35.9Q22.5-35.9 25.4-34.1Q28.3-32.3 30.1-29.1L28.4-27Q27-29.7 25-31.1Q23-32.5 20.4-32.5Q18-32.5 16-30.9Q14-29.3 12.9-26Q11.8-22.8 11.8-17.6Q11.8-12.8 12.8-9.6Q13.9-6.5 15.8-5Q17.6-3.4 20-3.4Q22.4-3.4 24.5-4.8Q26.6-6.1 28.4-9L29.4-7.4Q26.6-3.3 23.4-1.2Q20.2 0.8 16.2 0.8Q11.9 0.8 8.7-1.3Q5.4-3.4 3.6-7.3Q1.8-11.2 1.8-16.6Z' +
  'M68.3-3V-6.8L68.2-7V-28.2Q68.2-29 68-29.3Q67.7-29.6 67.2-29.8L65.1-29.8Q64.6-30 64.4-30.3Q64.2-30.6 64.2-31Q64.2-31.5 64.5-31.8Q64.8-32.2 65.5-32.4L74.1-35.1Q75.1-35.5 75.6-35.6Q76.1-35.7 76.6-35.7Q77.2-35.7 77.6-35.3Q77.9-34.9 77.9-34.2V-5.1Q77.9-4.1 78.2-3.6Q78.5-3.1 79.1-3L80.7-2.6Q81.2-2.4 81.4-2Q81.7-1.7 81.7-1.2Q81.7-0.6 81.3-0.3Q80.9 0 80.3 0H71.3Q69.8 0 69-0.8Q68.3-1.6 68.3-3ZM45.8-9.8V-28.2Q45.8-29 45.6-29.3Q45.4-29.6 44.8-29.8L42.8-29.8Q42.2-30 42-30.3Q41.8-30.6 41.8-31Q41.8-31.5 42.1-31.8Q42.4-32.2 43.1-32.4L51.8-35.1Q52.8-35.5 53.2-35.6Q53.8-35.7 54.2-35.7Q54.9-35.7 55.2-35.3Q55.6-34.9 55.6-34.2V-11.5Q55.6-8.2 57-6.6Q58.5-5 61-5Q62.6-5 64.3-5.8Q66-6.5 67.8-8.2L69.2-9.4L70.4-7.9L68.9-6.4Q64.8-2.5 61.4-0.8Q58.1 0.8 55 0.8Q50.9 0.8 48.4-1.9Q45.8-4.6 45.8-9.8Z' +
  'M153-19.7Q153-25.2 154.4-28.8Q155.9-32.3 158.2-34.1Q160.6-35.9 163.3-35.9Q166.4-35.9 168.1-34Q169.8-32 169.8-28.4Q169.8-25.2 168.5-23.6Q167.1-22.1 165.1-22.1Q163-22.1 162-23.2Q161-24.3 160.9-26.3L160.9-27.6Q160.9-28.8 160.4-29.4Q159.9-30 158.8-30Q157.5-30 156.4-28.9Q155.3-27.8 154.6-25.5Q153.9-23.2 153.9-19.8ZM153.6-34 153.9-23.4V-5.2Q153.9-4.3 154.2-3.8Q154.6-3.2 155.4-3.1L158.6-2.6Q159.3-2.5 159.6-2.1Q159.8-1.8 159.8-1.2Q159.8-0.7 159.5-0.4Q159.1 0 158.4 0H141.8Q141.1 0 140.7-0.3Q140.4-0.7 140.4-1.2Q140.4-1.7 140.6-2Q140.9-2.4 141.4-2.6L143-3Q143.6-3.2 143.9-3.6Q144.1-4.1 144.1-5V-28.3Q144.1-29.1 143.9-29.4Q143.7-29.8 143.2-30L141-30Q140.6-30.2 140.4-30.5Q140.1-30.8 140.1-31.2Q140.1-31.6 140.4-32Q140.7-32.4 141.5-32.6L150.2-35.1Q151-35.4 151.5-35.5Q152-35.6 152.4-35.6Q153-35.6 153.2-35.3Q153.5-34.9 153.6-34Z' +
  'M192.9-4.4V-5.2L192.2-5.1V-28Q192.2-30.7 191-32.2Q189.8-33.6 187.6-33.6Q185.3-33.6 184.2-32.6Q183-31.5 183-30V-27.5Q183-25.3 181.6-24Q180.2-22.7 177.9-22.7Q175.9-22.7 174.8-23.7Q173.8-24.8 173.8-26.7Q173.8-29 175.5-31.1Q177.2-33.2 180.6-34.6Q184.1-35.9 189.1-35.9Q195.6-35.9 198.8-33.2Q202-30.4 202-25.5V-6.2Q202-5 202.4-4.5Q202.9-3.9 203.7-3.9Q204.3-3.9 204.7-4.2Q205.2-4.5 205.4-5.2Q205.4-5.3 205.6-5.4Q205.7-5.5 205.9-5.5Q206.3-5.5 206.5-5.2Q206.6-4.9 206.6-4.5Q206.6-3.4 205.9-2.2Q205.1-1 203.5-0.1Q202 0.8 199.5 0.8Q196.4 0.8 194.6-0.7Q192.9-2.2 192.9-4.4ZM172-7.9Q172-12.6 175.9-15.4Q179.7-18.1 187.1-18.1Q189.3-18.1 191-17.7Q192.7-17.3 194-16.7L193.4-14.8Q192.1-15.4 190.8-15.8Q189.5-16.1 187.9-16.1Q185-16.1 183.4-14.4Q181.8-12.6 181.8-9.6Q181.8-6.6 183.3-5Q184.8-3.5 187.2-3.5Q189-3.5 190.6-4.3Q192.3-5.2 193.4-6.7L194-5Q192.2-2.2 189.1-0.7Q186 0.8 182.3 0.8Q177.6 0.8 174.8-1.6Q172-4 172-7.9Z'

const RING = { radius: 15.3, stroke: 6.0, centerY: -17.6, firstX: 102.6, secondX: 118.6 } as const

const RING_CLASS = 'fill-none'
const MOVES = 'transition-transform duration-300 ease-out'
const MOVES_LEFT = `${MOVES} motion-safe:group-hover:-translate-x-1 motion-safe:group-focus-visible:-translate-x-1`
const MOVES_RIGHT = `${MOVES} motion-safe:group-hover:translate-x-1 motion-safe:group-focus-visible:translate-x-1`

interface LogoProps {
  readonly className?: string
}

/**
 * Wordmark com os anéis entrelaçados: o rosa-chá passa por cima no cruzamento de cima, e um trecho do
 * damasco, recortado pelo clipPath, passa por cima no de baixo. Ao passar o mouse sobre o link que contém
 * o logo (`group`), os anéis se afastam e voltam, só para quem não pediu menos movimento.
 */
export function Logo({ className }: LogoProps) {
  const clipId = useId()

  return (
    <svg viewBox="1 -60 205 61" role="img" aria-label="Duora" className={className}>
      <defs>
        <clipPath id={clipId}>
          <rect x="102.6" y="-17.6" width="21.3" height="21.3" />
        </clipPath>
      </defs>
      <path d={LETTERS} fill="currentColor" />
      <g className={MOVES_LEFT}>
        <circle cx={RING.firstX} cy={RING.centerY} r={RING.radius} strokeWidth={RING.stroke} className={`${RING_CLASS} stroke-primary`} />
      </g>
      <circle
        cx={RING.secondX}
        cy={RING.centerY}
        r={RING.radius}
        strokeWidth={RING.stroke}
        className={`${RING_CLASS} stroke-accent ${MOVES_RIGHT}`}
      />
      <g className={MOVES_LEFT}>
        <circle
          cx={RING.firstX}
          cy={RING.centerY}
          r={RING.radius}
          strokeWidth={RING.stroke}
          clipPath={`url(#${clipId})`}
          className={`${RING_CLASS} stroke-primary`}
        />
      </g>
    </svg>
  )
}
