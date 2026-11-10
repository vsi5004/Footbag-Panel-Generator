import type { Panel, Point } from '../types';
import { CONSTANTS } from './constants';
import { geometry } from './geometry';

const cache = new WeakMap<Panel, Map<number, ReturnType<typeof measure>>>();
function measure(panel: Panel, dot: number) {
  const points: Point[] = [];
  let previous: Point | undefined;
  for (const match of panel.outlinePath.matchAll(/([MLA])\s*([^MLAZ]+)/g)) {
    const v = match[2]
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const end = { x: v[v.length - 2], y: v[v.length - 1] };
    points.push(end);
    if (match[1] === 'A' && previous) {
      const radius = Math.max(v[0], Math.hypot(end.x - previous.x, end.y - previous.y) / 2);
      const arc = geometry.getSvgCircularArcParams(
        previous,
        end,
        radius,
        v[3] as 0 | 1,
        v[4] as 0 | 1,
      );
      if (!arc.valid) throw new Error('Invalid outline arc');
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2;
        const tau = 2 * Math.PI;
        const distance = (((Math.sign(arc.dAng) * (angle - arc.angA)) % tau) + tau) % tau;
        if (distance <= Math.abs(arc.dAng) + 1e-10)
          points.push({
            x: arc.c.x + radius * Math.cos(angle),
            y: arc.c.y + radius * Math.sin(angle),
          });
      }
    }
    previous = end;
  }
  const stroke = CONSTANTS.STROKES.cut / 2;
  let minX = Math.min(...points.map((p) => p.x)) - stroke;
  let maxX = Math.max(...points.map((p) => p.x)) + stroke;
  let minY = Math.min(...points.map((p) => p.y)) - stroke;
  let maxY = Math.max(...points.map((p) => p.y)) + stroke;
  const radius = Math.max(0.1, dot / 2);
  for (const p of panel.stitches) {
    // SVG circles serialize centers and radii to three decimals.
    const x = Number(p.x.toFixed(3)),
      y = Number(p.y.toFixed(3)),
      r = Number(radius.toFixed(3));
    minX = Math.min(minX, x - r);
    maxX = Math.max(maxX, x + r);
    minY = Math.min(minY, y - r);
    maxY = Math.max(maxY, y + r);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}
/** Exact cut-stroke extents unioned with circles that actually exist. */
export function panelExtents(panel: Panel, dot: number) {
  let entries = cache.get(panel);
  if (!entries) cache.set(panel, (entries = new Map()));
  let value = entries.get(dot);
  if (!value) {
    value = measure(panel, dot);
    if (entries.size >= 8) entries.clear();
    entries.set(dot, value);
  }
  return value;
}
