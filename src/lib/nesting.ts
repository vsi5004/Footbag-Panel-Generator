import { translationLattices } from './translation-nesting';
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
import { minimumSafePitch } from './pitch-search';
import { fillStock } from './stock-fill';

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
  const turns = outline.map((a, i) => {
    const b = outline[(i + 1) % outline.length],
      c = outline[(i + 2) % outline.length];
    return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
  });
  const concave = turns.some((v) => v > 1e-9) && turns.some((v) => v < -1e-9);
  let best: Placement[] = [];
  let bestArea = Infinity;
  let bestLattice: Lattice | undefined;
  // Stock pitch checks use a periodic local sample. Many column counts have
  // exactly the same sample; solve it once, then validate each full candidate.
  const pitches = new Map<string, [number, number]>();
  const envelopes = new Map<string, ReturnType<typeof measurePlaced>>();
  const consider = (lattice: Lattice): void => {
    const full = latticePlacements(lattice, stock?.height !== undefined ? 2 * count : count);
    let candidate = full;
    if (stock?.height !== undefined) {
      // A staggered row can have one fewer panel than its neighbor. An
      // overflowing panel must not discard every valid placement after it.
      const boxes = full.map((at) => {
        const key = `${at.angle},${!!at.flipY}`;
        let box = envelopes.get(key);
        if (!box) {
          box = measurePlaced(panel, [{ ...at, x: 0, y: 0 }], dot, padding);
          envelopes.set(key, box);
        }
        return { ...box, minX: box.minX + at.x, minY: box.minY + at.y };
      });
      const origin = {
        minX: Math.min(...boxes.map((b) => b.minX)),
        minY: Math.min(...boxes.map((b) => b.minY)),
      };
      candidate = full
        .filter((_, index) => {
          const box = boxes[index];
          return (
            box.minX >= origin.minX - 1e-8 &&
            box.minY >= origin.minY - 1e-8 &&
            box.minX + box.width <= origin.minX + stock.width + 1e-8 &&
            box.minY + box.height <= origin.minY + stock.height! + 1e-8
          );
        })
        .slice(0, count);
      if (!candidate.length || candidate.length < best.length) return;
    }
    const size = measurePlaced(panel, candidate, dot, padding);
    if (
      stock &&
      (size.width > stock.width || (stock.height !== undefined && size.height > stock.height))
    )
      return;

    const score = stock && stock.height === undefined ? size.height : size.width * size.height;
    if (
      (candidate.length > best.length || (candidate.length === best.length && score < bestArea)) &&
      checkPlacements(outline, candidate, clearance)
    ) {
      bestArea = score;
      best = candidate;
      bestLattice = candidate.every((at, i) => at === full[i]) ? lattice : undefined;
    }
  };
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
          const pitchKey = stock
            ? [angle, pattern, seed, Math.min(cols, 3), Math.min(Math.ceil(count / cols), 3)].join(
                ',',
              )
            : undefined;
          const cached = pitchKey ? pitches.get(pitchKey) : undefined;
          if (cached) [px, py] = cached;
          else {
            for (let pass = 0; pass < 2; pass++)
              for (const axis of pattern === 2 ? ['y', 'x'] : ['x', 'y']) {
                const high = minimumSafePitch(
                  axis === 'x' ? px : py,
                  (mid) => {
                    if (axis === 'x') px = mid;
                    else py = mid;
                    return checkPlacements(
                      outline,
                      stock
                        ? build(
                            Math.min(cols, 3) * Math.min(Math.ceil(count / cols), 3),
                            Math.min(cols, 3),
                          )
                        : build(),
                      clearance,
                    );
                  },
                  concave,
                );
                if (axis === 'x') px = high;
                else py = high;
              }
            if (pitchKey) pitches.set(pitchKey, [px, py]);
          }
          for (const finalPattern of stock && pattern === 4 ? [4, 5] : [pattern]) {
            consider({
              columns: cols,
              pitchX: px,
              pitchY: py,
              pattern: finalPattern as Lattice['pattern'],
              angle,
              rotateAlternates: rotations !== 'none',
            });
          }
        }
  }
  for (const lattice of translationLattices(outline, count, clearance, rotations))
    consider(lattice);
  if (stock?.height && best.length < count) {
    for (const seed of best.length ? [best, []] : [[]]) {
      const filled = fillStock(panel, seed, count, stock, rotations, clearance, dot, padding);
      if (
        filled.length > best.length &&
        (capacity || filled.length === count) &&
        checkPlacements(outline, filled, clearance)
      ) {
        best = filled;
        bestLattice = undefined;
      }
    }
  }
  if (!best.length || (!capacity && best.length !== count))
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
