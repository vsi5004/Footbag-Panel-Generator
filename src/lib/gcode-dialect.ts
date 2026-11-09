/** The same word grammar is used by snippet validation and the toolpath preview. */
export function gcodeWords(raw: string): [string, number][] {
  const line = raw
    .replace(/\([^)]*\)/g, '')
    .split(';')[0]
    .toUpperCase();
  return [...line.matchAll(/([A-Z])\s*([-+]?(?:\d+\.?\d*|\.\d+))/g)].map((m) => [
    m[1],
    Number(m[2]),
  ]);
}
export const isProgramEnd = (letter: string, value: number) =>
  letter === 'M' && (value === 2 || value === 30);
export function validateStartCode(code: string): void {
  if (
    code
      .split(/\r?\n/)
      .some((line) => gcodeWords(line).some(([letter, n]) => isProgramEnd(letter, n)))
  )
    throw new Error('Start GCode contains a program-end command (M2/M30). Move it to End GCode.');
}
