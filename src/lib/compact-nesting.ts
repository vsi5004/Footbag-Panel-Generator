import type { Panel } from '../types';
import { flattenOutline, polygonsTooClose } from './nesting-geometry';
import { bounds, measurePlaced, transform, type Placement } from './nesting-types';

/** Keep count and orientations fixed while moving panels toward one corner.
 * Only validated final positions are accepted; panels do not need a collision-
 * free physical travel path because these are uncut layout coordinates. */
export function compactPlacements(
  panel: Panel,
  initial: Placement[],
  clearance: number,
  dot: number,
  padding: number,
  firstAxis: 'x' | 'y',
): Placement[] {
  const placed = initial.map((p) => ({ ...p }));
  const outline = flattenOutline(panel.outlinePath);
  const local = placed.map((p) => outline.map((v) => transform(v, { ...p, x: 0, y: 0 })));
  const polygons = placed.map((p, i) => local[i].map((v) => ({ x: v.x + p.x, y: v.y + p.y })));
  const boxes = polygons.map(bounds);
  const envelope = measurePlaced(panel, placed, dot, padding);
  const origins = placed.map((p) => measurePlaced(panel, [{ ...p, x: 0, y: 0 }], dot, padding));
  const axes = firstAxis === 'x' ? (['x', 'y'] as const) : (['y', 'x'] as const);
  for (let pass = 0; pass < 2; pass++)
    for (const axis of axes) {
      const order = placed
        .map((_, i) => i)
        .sort(
          (a, b) =>
            boxes[a][axis === 'x' ? 'minX' : 'minY'] - boxes[b][axis === 'x' ? 'minX' : 'minY'] ||
            a - b,
        );
      for (const index of order) {
        const at = placed[index];
        const target =
          axis === 'x' ? envelope.minX - origins[index].minX : envelope.minY - origins[index].minY;
        if (at[axis] - target < 0.00001) continue;
        const safe = (value: number) => {
          const x = axis === 'x' ? value : at.x,
            y = axis === 'y' ? value : at.y;
          const poly = local[index].map((p) => ({ x: p.x + x, y: p.y + y }));
          const box = bounds(poly);
          return !polygons.some((other, i) => {
            if (i === index) return false;
            const b = boxes[i];
            if (
              box.maxX + clearance < b.minX ||
              b.maxX + clearance < box.minX ||
              box.maxY + clearance < b.minY ||
              b.maxY + clearance < box.minY
            )
              return false;
            return polygonsTooClose(poly, other, clearance);
          });
        };
        let low = target,
          high = at[axis];
        if (safe(target)) high = target;
        else
          for (let step = 0; step < 12; step++) {
            const mid = (low + high) / 2;
            if (safe(mid)) high = mid;
            else low = mid;
          }
        at[axis] = high;
        polygons[index] = local[index].map((p) => ({ x: p.x + at.x, y: p.y + at.y }));
        boxes[index] = bounds(polygons[index]);
      }
    }
  return placed;
}
