import { latticePlacements, type Lattice } from './lattice';
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

export interface NestingRequest {
  panel: Panel;
  count: number;
  gap: number;
  rotations: RotationMode;
  source: string;
  padding: number;
  dot: number;
  currentCols: number;
  stock?: StockSize;
  capacity?: boolean;
}

export function findNesting({
  panel,
  count,
  gap,
  rotations,
  source,
  padding,
  dot,
  currentCols,
  stock,
  capacity = false,
}: NestingRequest): NestingPlan {
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
  let bestLattice: Lattice | undefined;
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
      for (const pattern of rotations === 'none' ? [0, 2, 4] : [0, 1, 2, 3, 4])
        for (const seed of stock && (pattern === 2 || pattern === 4) ? [0, 2, 4, 6, 8] : [0]) {
          let px = box.width + clearance + 0.01,
            py = box.height + clearance + 0.01;
          const build = (length = count, columns = cols): Placement[] =>
            latticePlacements(
              {
                columns,
                pitchX: px,
                pitchY: py,
                pattern: pattern as Lattice['pattern'],
                angle,
                rotateAlternates: rotations !== 'none',
              },
              length,
            );
          if (pattern > 0) {
            px = 2 * Math.max(Math.abs(box.minX), Math.abs(box.maxX)) + clearance + 0.01;
            py = 2 * Math.max(Math.abs(box.minY), Math.abs(box.maxY)) + clearance + 0.01;
          }
          // Begin staggered searches with space to interleave. Reducing the
          // horizontal pitch first from a tight grid traps flat-top hexagons
          // in the original grid instead of reaching the denser staggered rows.
          if (pattern === 2) px *= 2;
          if (pattern === 4) py *= 2;
          // Stock fit depends on both pitches, not just minimum bounding area.
          // Explore different interleaving starts: coordinate descent from one
          // loose grid can settle on a sparse but locally tight arrangement.
          if (seed) {
            if (pattern === 2) px = (box.width + clearance + 0.01) * (0.5 + seed / 4);
            else py = (box.height + clearance + 0.01) * (0.5 + seed / 4);
          }
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
          for (const finalPattern of stock && pattern === 4 ? [4, 5] : [pattern]) {
            let candidate = latticePlacements(
              {
                columns: cols,
                pitchX: px,
                pitchY: py,
                pattern: finalPattern as Lattice['pattern'],
                angle,
                rotateAlternates: rotations !== 'none',
              },
              count,
            );
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
              (size.width > stock.width ||
                (stock.height !== undefined && size.height > stock.height))
            )
              continue;
            if (!checkPlacements(outline, candidate, clearance)) continue;
            const score =
              stock && stock.height === undefined ? size.height : size.width * size.height;
            if ((capacity && candidate.length > best.length) || score < bestArea) {
              bestArea = score;
              best = candidate;
              bestLattice = {
                columns: cols,
                pitchX: px,
                pitchY: py,
                pattern: finalPattern as Lattice['pattern'],
                angle,
                rotateAlternates: rotations !== 'none',
              };
            }
          }
        }
  }
  if (!best.length)
    throw new Error(
      stock
        ? 'No arrangement found within the stock limits. Try fewer panels, larger stock or more rotations.'
        : 'No safe arrangement found.',
    );
  return { version: 1, source, gap, lattice: bestLattice, placements: best };
}

export function findCapacity(
  request: Omit<NestingRequest, 'count' | 'currentCols' | 'capacity'> & { stock: StockSize },
): NestingPlan {
  return findNesting({ ...request, count: 144, currentCols: 12, capacity: true });
}
