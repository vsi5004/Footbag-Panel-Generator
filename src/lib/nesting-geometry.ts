import type { Point } from '../types';
import { geometry } from './geometry';
import { bounds, transform, OUTLINE_TOLERANCE, type Placement } from './nesting-types';

// Follow the rounded SVG outline, including SVG radius correction.
export function flattenOutline(path: string, tolerance = OUTLINE_TOLERANCE): Point[] {
  if (!(tolerance > 0) || !Number.isFinite(tolerance)) throw new Error('Invalid curve tolerance');
  const points: Point[] = [];
  let previous: Point | undefined;
  for (const match of path.matchAll(/([MLA])\s*([^MLAZ]+)/g)) {
    const v = match[2]
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const end = { x: v[v.length - 2], y: v[v.length - 1] };
    if (!Number.isFinite(end.x + end.y)) throw new Error('Invalid outline');
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
      const step = 2 * Math.acos(Math.max(-1, 1 - tolerance / radius));
      const count = Math.max(1, Math.ceil(Math.abs(arc.dAng) / step));
      if (count > 4096) throw new Error('Outline too complex');
      for (let i = 1; i < count; i++) {
        const angle = arc.angA + (arc.dAng * i) / count;
        points.push({
          x: arc.c.x + radius * Math.cos(angle),
          y: arc.c.y + radius * Math.sin(angle),
        });
      }
    }
    points.push(end);
    previous = end;
  }
  const last = points[points.length - 1];
  if (points.length > 1 && Math.hypot(points[0].x - last.x, points[0].y - last.y) < 1e-9)
    points.pop();
  if (points.length < 3) throw new Error('Invalid outline');
  return points;
}
function cross(a: Point, b: Point, c: Point) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
function pointSegmentSquared(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)),
  );
  return (p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2;
}
function intersects(a: Point, b: Point, c: Point, d: Point) {
  const abC = cross(a, b, c),
    abD = cross(a, b, d),
    cdA = cross(c, d, a),
    cdB = cross(c, d, b);
  if (abC * abD < 0 && cdA * cdB < 0) return true;
  return (
    (Math.abs(abC) < 1e-9 && pointSegmentSquared(c, a, b) < 1e-18) ||
    (Math.abs(abD) < 1e-9 && pointSegmentSquared(d, a, b) < 1e-18) ||
    (Math.abs(cdA) < 1e-9 && pointSegmentSquared(a, c, d) < 1e-18) ||
    (Math.abs(cdB) < 1e-9 && pointSegmentSquared(b, c, d) < 1e-18)
  );
}
export function contains(poly: Point[], p: Point) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}
export function isSimple(poly: Point[]) {
  for (let i = 0; i < poly.length; i++)
    for (let j = i + 2; j < poly.length; j++) {
      if (i === 0 && j === poly.length - 1) continue;
      if (intersects(poly[i], poly[(i + 1) % poly.length], poly[j], poly[(j + 1) % poly.length]))
        return false;
    }
  return true;
}
export function polygonsTooClose(a: Point[], b: Point[], gap: number): boolean {
  const gap2 = gap * gap + 1e-12;
  for (let i = 0; i < a.length; i++) {
    const p = a[i],
      q = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      const r = b[j],
        s = b[(j + 1) % b.length];
      if (
        Math.max(p.x, q.x) + gap < Math.min(r.x, s.x) ||
        Math.max(r.x, s.x) + gap < Math.min(p.x, q.x) ||
        Math.max(p.y, q.y) + gap < Math.min(r.y, s.y) ||
        Math.max(r.y, s.y) + gap < Math.min(p.y, q.y)
      )
        continue;
      if (
        intersects(p, q, r, s) ||
        Math.min(
          pointSegmentSquared(p, r, s),
          pointSegmentSquared(q, r, s),
          pointSegmentSquared(r, p, q),
          pointSegmentSquared(s, p, q),
        ) <= gap2
      )
        return true;
    }
  }
  return contains(a, b[0]) || contains(b, a[0]);
}
export function checkPlacements(outline: Point[], placements: Placement[], gap: number): boolean {
  const polygons = placements.map((at) => outline.map((p) => transform(p, at)));
  const boxes = polygons.map(bounds),
    checked = new Map<string, boolean>();
  for (let i = 0; i < placements.length; i++)
    for (let j = i + 1; j < placements.length; j++) {
      const a = boxes[i],
        b = boxes[j];
      if (
        a.maxX + gap < b.minX ||
        b.maxX + gap < a.minX ||
        a.maxY + gap < b.minY ||
        b.maxY + gap < a.minY
      )
        continue;
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
      let collision = checked.get(key);
      if (collision === undefined) {
        collision = polygonsTooClose(polygons[i], polygons[j], gap);
        checked.set(key, collision);
      }
      if (collision) return false;
    }
  return true;
}
