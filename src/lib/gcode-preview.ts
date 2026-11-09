import { gcodeWords, isProgramEnd } from './gcode-dialect';
import type { Point } from '../types';

export interface ToolMove {
  from: Point;
  to: Point;
  cut: boolean;
}

/** Read the exported text, including linear moves in custom start/end snippets.
 * Unsupported machine commands remain in the export and are called out in the viewer.
 */
export function parseGcode(code: string) {
  const moves: ToolMove[] = [],
    warnings = new Set<string>();
  let cursor = { x: 0, y: 0 },
    absolute = true,
    unit = 1,
    motion = 0,
    power = 0,
    enabled = false;
  let terminated = false,
    positionKnown = true;
  for (const raw of code.split(/\r?\n/)) {
    if (terminated) break;
    const words = gcodeWords(raw);
    if (!words.length) continue;
    const values = new Map(words);
    let resetPosition = false,
      unsupportedMotion = false;
    for (const [letter, number] of words) {
      const n = Number(number);
      if (letter === 'G') {
        if (n === 0 || n === 1) motion = n;
        else if (n === 90) absolute = true;
        else if (n === 91) absolute = false;
        else if (n === 20) unit = 25.4;
        else if (n === 21) unit = 1;
        else if (n === 92) resetPosition = true;
        else if (n === 2 || n === 3) {
          motion = n;
          warnings.add(`G${n}`);
        } else if (n !== 94) {
          warnings.add(`G${n}`);
          unsupportedMotion = true;
          if ([10, 28, 30, 53, 54, 55, 56, 57, 58, 59].includes(n)) positionKnown = false;
        }
      }
      if (letter === 'M') {
        if (n === 3 || n === 4) enabled = true;
        else if (n === 5) enabled = false;
        else if (isProgramEnd(letter, n)) terminated = true;
        else warnings.add(`M${n}`);
      }
    }
    if (values.has('S')) power = values.get('S')!;
    if (values.has('Z')) warnings.add('Z motion');
    if (unsupportedMotion || terminated) continue;
    if (values.has('X') || values.has('Y')) {
      const next = {
        x: values.has('X')
          ? values.get('X')! * unit + (absolute || resetPosition ? 0 : cursor.x)
          : cursor.x,
        y: values.has('Y')
          ? values.get('Y')! * unit + (absolute || resetPosition ? 0 : cursor.y)
          : cursor.y,
      };
      if (
        positionKnown &&
        !resetPosition &&
        motion <= 1 &&
        Math.hypot(next.x - cursor.x, next.y - cursor.y) > 1e-8
      )
        moves.push({ from: cursor, to: next, cut: motion === 1 && enabled && power > 0 });
      cursor = next;
      if ((absolute || resetPosition) && values.has('X') && values.has('Y')) positionKnown = true;
    }
  }
  let cutDistance = 0,
    travelDistance = 0;
  for (const m of moves) {
    const length = Math.hypot(m.to.x - m.from.x, m.to.y - m.from.y);
    if (m.cut) cutDistance += length;
    else travelDistance += length;
  }
  return { moves, warnings: [...warnings], cutDistance, travelDistance };
}
