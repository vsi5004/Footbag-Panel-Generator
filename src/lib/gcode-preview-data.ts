import type { ToolMove } from './gcode-preview';
import { gcodeNumber } from './gcode-types';
export function prepareGcodePreview(
  sheet: { minX: number; minY: number; width: number; height: number },
  moves: ToolMove[],
) {
  let x0 = Math.min(0, sheet.minX),
    y0 = Math.min(0, sheet.minY),
    x1 = Math.max(0, sheet.minX + sheet.width),
    y1 = Math.max(0, sheet.minY + sheet.height);
  for (const move of moves)
    for (const p of [move.from, move.to]) {
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    }
  const margin = Math.max(x1 - x0, y1 - y0) * 0.03 + 1;
  const box = [x0 - margin, -y1 - margin, x1 - x0 + 2 * margin, y1 - y0 + 2 * margin];

  const cut: string[] = [],
    travel: string[] = [];
  for (const m of moves)
    (m.cut ? cut : travel).push(
      `M${gcodeNumber(m.from.x)} ${gcodeNumber(-m.from.y)}L${gcodeNumber(m.to.x)} ${gcodeNumber(-m.to.y)}`,
    );
  return { box, cut: cut.join(' '), travel: travel.join(' '), sheet };
}
export type GcodePreviewData = ReturnType<typeof prepareGcodePreview>;
