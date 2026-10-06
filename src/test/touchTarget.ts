/**
 * 44×44px (`min-h-11 min-w-11`), o alvo de toque da WCAG 2.5.5; `min-h-12` (48px) também vale, no campo
 * e no botão maiores do hero. O jsdom não faz layout, então a checagem lê as classes.
 */
function hasTouchTargetSize(element: Element): boolean {
  const isTallEnough = element.classList.contains('min-h-11') || element.classList.contains('min-h-12')
  return isTallEnough && element.classList.contains('min-w-11')
}

/** O HTML de cada link, botão ou campo sem o alvo de 44px, para a falha mostrar qual é. */
export function elementsWithoutTouchTarget(container: Element): string[] {
  return [...container.querySelectorAll('a, button, input, select, textarea')]
    .filter((element) => !hasTouchTargetSize(element))
    .map((element) => element.outerHTML)
}
