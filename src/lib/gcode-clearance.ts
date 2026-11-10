import ClipperLib from 'clipper-lib';
import type { Point } from '../types';
import { bounds, transform, type Placement } from './nesting-types';

const SCALE = 100000;
/** Offset/serialization coordinates are accurate to 0.00001 mm. Permit shared
 * boundaries and rounding slivers, but reject positive interior penetration. */
export function checkCutInteriors(outline: Point[], placements: Placement[]): boolean {
  const polygons = placements.map((at) => outline.map((p) => transform(p, at)));
  const boxes = polygons.map(bounds);
  const paths = polygons.map((poly) =>
    poly.map((p) => ({ X: Math.round(p.x * SCALE), Y: Math.round(p.y * SCALE) })),
  );
  const checked = new Map<string, boolean>();
  for (let i = 0; i < paths.length; i++)
    for (let j = i + 1; j < paths.length; j++) {
      const a = boxes[i],
        b = boxes[j];
      if (a.maxX <= b.minX || b.maxX <= a.minX || a.maxY <= b.minY || b.maxY <= a.minY) continue;
      const p = placements[i],
        q = placements[j];
      const key = [
        p.angle,
        p.flipY,
        q.angle,
        q.flipY,
        (q.x - p.x).toFixed(6),
        (q.y - p.y).toFixed(6),
      ].join(',');
      let overlap = checked.get(key);
      if (overlap === undefined) {
        const clipper = new ClipperLib.Clipper();
        clipper.AddPath(paths[i], ClipperLib.PolyType.ptSubject, true);
        clipper.AddPath(paths[j], ClipperLib.PolyType.ptClip, true);
        const intersections: ClipperLib.Paths = [];
        clipper.Execute(
          ClipperLib.ClipType.ctIntersection,
          intersections,
          ClipperLib.PolyFillType.pftNonZero,
          ClipperLib.PolyFillType.pftNonZero,
        );
        overlap = false;
        if (intersections.length) {
          // Remove only two integer-grid units from the intersection. This
          // tolerates offset rounding without allowing a meaningful overlap.
          const inset = new ClipperLib.ClipperOffset(2, 0.001 * SCALE);
          inset.AddPaths(
            intersections,
            ClipperLib.JoinType.jtMiter,
            ClipperLib.EndType.etClosedPolygon,
          );
          const interior: ClipperLib.Paths = [];
          inset.Execute(interior, -2);
          overlap = interior.some((path) => Math.abs(ClipperLib.Clipper.Area(path)) > 0);
        }
        checked.set(key, overlap);
      }
      if (overlap) return false;
    }
  return true;
}
