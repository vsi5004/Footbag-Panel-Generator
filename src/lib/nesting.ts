import type { Panel } from '../types';
import {
  bounds,
  transform,
  measurePlaced,
  CLEARANCE_ALLOWANCE,
  type Placement,
  type NestingPlan,
  type StockSize,
  type RotationMode,
} from './nesting-types';
import { flattenOutline, checkPlacements, isSimple } from './nesting-geometry';

export function findNesting(
  panel: Panel,
  count: number,
  gap: number,
  quarterTurn: boolean | RotationMode,
  source: string,
  padding: number,
  dot: number,
  currentCols: number,
  stock?: StockSize,
  capacity = false,
): NestingPlan {
  if (
    !Number.isFinite(padding) ||
    padding < 0 ||
    !Number.isFinite(dot) ||
    dot < 0 ||
    !Number.isInteger(currentCols) ||
    currentCols < 1 ||
    currentCols > 144 ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 144 ||
    !Number.isFinite(gap) ||
    gap < 0 ||
    gap > 20
  )
    throw new Error('Invalid nesting request');
  const rotations =
    typeof quarterTurn === 'boolean' ? (quarterTurn ? 'quarter' : 'half') : quarterTurn;
  if (!['none', 'half', 'quarter'].includes(rotations)) throw new Error('Invalid rotations');
  if (
    stock &&
    (!(stock.width > 0) ||
      !Number.isFinite(stock.width) ||
      (stock.height !== undefined && (!(stock.height > 0) || !Number.isFinite(stock.height))))
  )
    throw new Error('Invalid stock dimensions');
  if (capacity && !stock?.height) throw new Error('Capacity search requires width and height');
  const outline = flattenOutline(panel.outlinePath);
  if (!isSimple(outline))
    throw new Error('This outline crosses itself; automatic nesting is unavailable.');
  const clearance = gap + CLEARANCE_ALLOWANCE;
  let best: Placement[] = [];
  let bestArea = Infinity;
  const columns = stock
    ? Array.from({ length: count }, (_, i) => i + 1)
    : [
        ...new Set([
          currentCols,
          Math.ceil(count / currentCols),
          Math.ceil(Math.sqrt(count)),
          Math.max(1, Math.floor(Math.sqrt(count))),
          Math.max(1, Math.ceil(Math.sqrt(count) / 2)),
          Math.min(count, Math.ceil(Math.sqrt(count) * 2)),
        ]),
      ];
  for (const angle of (rotations === 'quarter' ? [0, 90] : [0]) as (0 | 90)[]) {
    const box = bounds(outline.map((p) => transform(p, { x: 0, y: 0, angle })));
    for (const cols of columns)
      for (const pattern of rotations === 'none' ? [0, 2, 4] : [0, 1, 2, 3, 4]) {
        let px = box.width + clearance + 0.01,
          py = box.height + clearance + 0.01;
        const build = (length = count, columns = cols): Placement[] =>
          Array.from({ length }, (_, i) => {
            const row = Math.floor(i / columns),
              col = i % columns;
            return {
              x: Number(((col + (pattern === 2 && row % 2 ? 0.5 : 0)) * px).toFixed(4)),
              y: Number(((row + (pattern === 4 && col % 2 ? 0.5 : 0)) * py).toFixed(4)),
              angle: (angle +
                (rotations !== 'none' &&
                (((pattern === 1 || pattern === 2) && row % 2) ||
                  ((pattern === 3 || pattern === 4) && col % 2))
                  ? 180
                  : 0)) as Placement['angle'],
            };
          });
        if (pattern > 0) {
          px = 2 * Math.max(Math.abs(box.minX), Math.abs(box.maxX)) + clearance + 0.01;
          py = 2 * Math.max(Math.abs(box.minY), Math.abs(box.maxY)) + clearance + 0.01;
        }
        // Begin staggered searches with space to interleave. Reducing the
        // horizontal pitch first from a tight grid traps flat-top hexagons
        // in the original grid instead of reaching the denser staggered rows.
        if (pattern === 2) px *= 2;
        if (pattern === 4) py *= 2;
        for (let pass = 0; pass < 2; pass++)
          for (const axis of pattern === 2 ? ['y', 'x'] : ['x', 'y']) {
            let low = 0,
              high = axis === 'x' ? px : py;
            for (let step = 0; step < 9; step++) {
              const mid = (low + high) / 2;
              if (axis === 'x') px = mid;
              else py = mid;
              if (
                checkPlacements(
                  outline,
                  stock
                    ? build(
                        Math.min(cols, 3) * Math.min(Math.ceil(count / cols), 3),
                        Math.min(cols, 3),
                      )
                    : build(),
                  clearance,
                )
              )
                high = mid;
              else low = mid;
            }
            if (axis === 'x') px = high;
            else py = high;
          }
        let candidate = build();
        if (capacity && stock) {
          // Prefix bounds are monotone for fixed placements. Find the largest
          // prefix fitting this lattice; final clearance checks use all panels.
          let low = 0,
            high = count;
          while (low < high) {
            const n = Math.ceil((low + high) / 2);
            const size = measurePlaced(panel, candidate.slice(0, n), dot, padding);
            if (size.width <= stock.width && size.height <= stock.height!) low = n;
            else high = n - 1;
          }
          candidate = candidate.slice(0, low);
          if (!candidate.length || candidate.length < best.length) continue;
        }
        const size = measurePlaced(panel, candidate, dot, padding);
        if (
          stock &&
          (size.width > stock.width || (stock.height !== undefined && size.height > stock.height))
        )
          continue;
        if (!checkPlacements(outline, candidate, clearance)) continue;
        const score = stock && stock.height === undefined ? size.height : size.width * size.height;
        if ((capacity && candidate.length > best.length) || score < bestArea) {
          bestArea = score;
          best = candidate;
        }
      }
  }
  if (!best.length)
    throw new Error(
      stock
        ? 'No arrangement found within the stock limits. Try fewer panels, larger stock or more rotations.'
        : 'No safe arrangement found.',
    );
  return { version: 1, source, gap, placements: best };
}

export function findCapacity(
  panel: Panel,
  gap: number,
  rotations: RotationMode,
  source: string,
  padding: number,
  dot: number,
  stock: StockSize,
): NestingPlan {
  return findNesting(panel, 144, gap, rotations, source, padding, dot, 12, stock, true);
}
