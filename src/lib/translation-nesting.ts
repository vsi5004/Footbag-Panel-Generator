import type { Point } from '../types';
import { latticePlacements, type Lattice } from './lattice';
import { bounds, transform, type RotationMode } from './nesting-types';
import { checkPlacements } from './nesting-geometry';

/** Rotation permission must not force alternating rotation. Explore translated
 * staggered rows/columns independently, including every possible column count. */
export function* translationLattices(
  outline: Point[],
  count: number,
  clearance: number,
  rotations: RotationMode,
): Generator<Lattice> {
  const solved = new Map<string, [number, number]>();
  for (const angle of (rotations === 'quarter' ? [0, 90] : [0]) as (0 | 90)[]) {
    const box = bounds(outline.map((p) => transform(p, { x: 0, y: 0, angle })));
    for (let columns = 1; columns <= count; columns++)
      for (const pattern of [2, 4] as const)
        for (const seed of [1, 1.5, 2]) {
          const sampleCols = Math.min(columns, 3),
            sampleRows = Math.min(Math.ceil(count / columns), 3);
          const key = [angle, pattern, seed, sampleCols, sampleRows].join(',');
          let pitches = solved.get(key);
          if (!pitches) {
            let pitchX = 2 * Math.max(Math.abs(box.minX), Math.abs(box.maxX)) + clearance + 0.01;
            let pitchY = 2 * Math.max(Math.abs(box.minY), Math.abs(box.maxY)) + clearance + 0.01;
            if (pattern === 2) pitchX *= seed;
            else pitchY *= seed;
            const sample = () =>
              latticePlacements(
                { columns: sampleCols, pitchX, pitchY, pattern, angle, rotateAlternates: false },
                sampleCols * sampleRows,
              );
            for (let pass = 0; pass < 2; pass++)
              for (const axis of pattern === 2 ? ['y', 'x'] : ['x', 'y']) {
                let low = 0,
                  high = axis === 'x' ? pitchX : pitchY;
                for (let step = 0; step < 12; step++) {
                  const mid = (low + high) / 2;
                  if (axis === 'x') pitchX = mid;
                  else pitchY = mid;
                  if (checkPlacements(outline, sample(), clearance)) high = mid;
                  else low = mid;
                }
                if (axis === 'x') pitchX = high;
                else pitchY = high;
              }
            pitches = [pitchX, pitchY];
            solved.set(key, pitches);
          }
          yield {
            columns,
            pitchX: pitches[0],
            pitchY: pitches[1],
            pattern,
            angle,
            rotateAlternates: false,
          };
        }
  }
}
