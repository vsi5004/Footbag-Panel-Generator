import type { Panel, Point } from '../types';
import { panelExtents } from './panel-extents';
import {
  bounds,
  measurePlaced,
  transform,
  type Placement,
  type RotationMode,
  type StockSize,
} from './nesting-types';
import { flattenOutline, polygonsTooClose } from './nesting-geometry';

/** Deterministic bounded gap fill. Accepted panels stay put; every addition uses
 * its own allowed orientation and exact stock extents, with outline clearance. */
export function fillStock(
  panel: Panel,
  initial: Placement[],
  count: number,
  stock: StockSize,
  rotations: RotationMode,
  gap: number,
  dot: number,
  padding: number,
): Placement[] {
  if (stock.height === undefined || initial.length >= count) return initial;
  const outline = flattenOutline(panel.outlinePath);
  const sheet = initial.length ? measurePlaced(panel, initial, dot, padding) : { minX: 0, minY: 0 };
  const placed = initial.map((p) => ({ ...p, x: p.x - sheet.minX, y: p.y - sheet.minY }));
  const polygons = placed.map((p) => outline.map((v) => transform(v, p)));
  const boxes = polygons.map(bounds);
  const extents = panelExtents(panel, dot);
  const corners = [
    { x: extents.minX, y: extents.minY },
    { x: extents.maxX, y: extents.maxY },
    { x: extents.minX, y: extents.maxY },
    { x: extents.maxX, y: extents.minY },
  ];
  const angles: Placement['angle'][] =
    rotations === 'none' ? [0] : rotations === 'half' ? [0, 180] : [0, 90, 180, 270];
  // At most about 26k grid sites per orientation, including the sheet boundaries.
  const step = Math.max(0.5, Math.max(stock.width, stock.height) / 160);
  for (const angle of angles) {
    const at = { x: 0, y: 0, angle };
    const local = outline.map((p) => transform(p, at));
    const extent = bounds(corners.map((p) => transform(p, at)));
    const minX = padding - extent.minX,
      maxX = stock.width - padding - extent.maxX;
    const minY = padding - extent.minY,
      maxY = stock.height - padding - extent.maxY;
    if (maxX < minX || maxY < minY) continue;
    const sites: Point[] = [];
    const xs = Array.from({ length: Math.ceil((maxX - minX) / step) + 1 }, (_, i) =>
      Math.min(maxX, minX + i * step),
    );
    const ys = Array.from({ length: Math.ceil((maxY - minY) / step) + 1 }, (_, i) =>
      Math.min(maxY, minY + i * step),
    );
    for (const y of ys) for (const x of xs) sites.push({ x, y });
    // Vertex contacts supplement the grid near narrow pockets and edges.
    const sample = (p: Point[]) =>
      p.filter((_, i) => i % Math.max(1, Math.ceil(p.length / 12)) === 0);
    for (const poly of polygons)
      for (const p of sample(poly))
        for (const q of sample(local))
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ])
            sites.push({ x: p.x - q.x + dx * (gap + 0.001), y: p.y - q.y + dy * (gap + 0.001) });
    sites.sort((a, b) => a.y - b.y || a.x - b.x);
    const seen = new Set<string>();
    for (const site of sites) {
      if (placed.length >= count) return placed;
      if (site.x < minX || site.x > maxX || site.y < minY || site.y > maxY) continue;
      const key = `${site.x.toFixed(4)},${site.y.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const candidate = { x: site.x, y: site.y, angle };
      const poly = local.map((p) => ({ x: p.x + site.x, y: p.y + site.y }));
      const box = bounds(poly);
      if (
        polygons.some((other, i) => {
          const b = boxes[i];
          if (
            box.maxX + gap < b.minX ||
            b.maxX + gap < box.minX ||
            box.maxY + gap < b.minY ||
            b.maxY + gap < box.minY
          )
            return false;
          return polygonsTooClose(poly, other, gap);
        })
      )
        continue;
      placed.push(candidate);
      polygons.push(poly);
      boxes.push(box);
    }
  }
  return placed;
}
