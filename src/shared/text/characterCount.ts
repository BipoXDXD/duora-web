/** Em caracteres, como a API conta (code points depois do NFC), e não em unidades UTF-16. */
export function characterCount(text: string): number {
  return [...text.normalize('NFC')].length
}
