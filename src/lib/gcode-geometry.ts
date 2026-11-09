import ClipperLib from 'clipper-lib';
import type { Point } from '../types';
import { geometry } from './geometry';
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
/** SVG circular arcs flattened by maximum chord length in physical output units. */
export function flattenCutOutline(path: string, length: number): Point[] {
  const points: Point[] = [];
  let previous: Point | undefined;
  for (const match of path.matchAll(/([MLA])\s*([^MLAZ]+)/g)) {
    const v = match[2]
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const end = { x: v[v.length - 2], y: v[v.length - 1] };
    if (!Number.isFinite(end.x + end.y)) throw new Error('Invalid panel outline');
    if (match[1] === 'A' && previous) {
      const radius = Math.max(v[0], distance(end, previous) / 2);
      const arc = geometry.getSvgCircularArcParams(
        previous,
        end,
        radius,
        v[3] as 0 | 1,
        v[4] as 0 | 1,
      );
      if (!arc.valid) throw new Error('Invalid panel arc');
      const count = Math.max(1, Math.ceil((Math.abs(arc.dAng) * radius) / length));
      if (count > 100000)
        throw new Error('Curve has too many segments; increase curve segment length');
      for (let i = 1; i < count; i++) {
        const angle = arc.angA + (arc.dAng * i) / count;
        points.push({
          x: arc.c.x + radius * Math.cos(angle),
          y: arc.c.y + radius * Math.sin(angle),
        });
      }
    }
    if (!previous || distance(points[points.length - 1], end) > 1e-8) points.push(end);
    previous = end;
  }
  if (points.length > 1 && distance(points[0], points[points.length - 1]) < 1e-8) points.pop();
  if (points.length < 3) throw new Error('Invalid panel outline');
  return points;
}

/** Clipper handles concave star roots as well as convex and curved panels. */
export function offsetOutline(points: Point[], amount: number): Point[] {
  if (!amount) return points;
  const scale = 100000;
  const path = points.map((p) => ({ X: Math.round(p.x * scale), Y: Math.round(p.y * scale) }));
  if (!ClipperLib.Clipper.Orientation(path)) path.reverse();
  const offset = new ClipperLib.ClipperOffset(2, 0.001 * scale);
  offset.AddPath(path, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
  const result: ClipperLib.Paths = [];
  offset.Execute(result, amount * scale);
  if (result.length !== 1 || result[0].length < 3)
    throw new Error('Kerf produces an invalid panel outline');
  return result[0].map((p) => ({ x: p.X / scale, y: p.Y / scale }));
}
