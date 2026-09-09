// Auto-nesting and common-line helpers for Footbag Panel Generator.
// DOM-independent by design so geometry can be tested and integrated separately.

export interface NestPoint { x: number; y: number }
export interface NestPolygon { points: NestPoint[]; rotation?: number }
export interface Placement { x: number; y: number; rotation: number; points: NestPoint[] }
export interface NestOptions {
  count: number;
  sheetWidth: number;
  sheetHeight: number;
  margin?: number;
  gap?: number;
  rotations?: number[];
}
export interface Segment { a: NestPoint; b: NestPoint }

const EPS = 1e-7;
const dist = (a: NestPoint, b: NestPoint) => Math.hypot(a.x - b.x, a.y - b.y);

function rotate(points: NestPoint[], degrees: number): NestPoint[] {
  const r = degrees * Math.PI / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return points.map(p => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c }));
}

function bounds(points: NestPoint[]) {
  return {
    minX: Math.min(...points.map(p => p.x)),
    minY: Math.min(...points.map(p => p.y)),
    maxX: Math.max(...points.map(p => p.x)),
    maxY: Math.max(...points.map(p => p.y)),
  };
}

function translate(points: NestPoint[], x: number, y: number): NestPoint[] {
  return points.map(p => ({ x: p.x + x, y: p.y + y }));
}

function orient(a: NestPoint, b: NestPoint, c: NestPoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a: NestPoint, b: NestPoint, p: NestPoint): boolean {
  return Math.abs(orient(a, b, p)) <= EPS &&
    p.x >= Math.min(a.x, b.x) - EPS && p.x <= Math.max(a.x, b.x) + EPS &&
    p.y >= Math.min(a.y, b.y) - EPS && p.y <= Math.max(a.y, b.y) + EPS;
}

function segmentsProperlyCross(a: NestPoint, b: NestPoint, c: NestPoint, d: NestPoint): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  return ((o1 > EPS && o2 < -EPS) || (o1 < -EPS && o2 > EPS)) &&
    ((o3 > EPS && o4 < -EPS) || (o3 < -EPS && o4 > EPS));
}

function pointInPolyStrict(p: NestPoint, poly: NestPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (onSegment(a, b, p)) return false;
    if (((a.y > p.y) !== (b.y > p.y)) &&
        p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

function polygonCentroid(points: NestPoint[]): NestPoint {
  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const cross = a.x * b.y - b.x * a.y;
    twiceArea += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  if (Math.abs(twiceArea) <= EPS) {
    return {
      x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
      y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
    };
  }
  return { x: cx / (3 * twiceArea), y: cy / (3 * twiceArea) };
}

function samePolygonBoundary(a: NestPoint[], b: NestPoint[]): boolean {
  return a.length === b.length && a.every(p => b.some(q => dist(p, q) <= EPS));
}

export function polygonsOverlap(a: NestPoint[], b: NestPoint[]): boolean {
  if (a.length < 3 || b.length < 3) return false;

  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      if (segmentsProperlyCross(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) {
        return true;
      }
    }
  }

  if (a.some(p => pointInPolyStrict(p, b)) || b.some(p => pointInPolyStrict(p, a))) return true;

  if (samePolygonBoundary(a, b)) return true;

  const ca = polygonCentroid(a);
  const cb = polygonCentroid(b);
  return pointInPolyStrict(ca, b) || pointInPolyStrict(cb, a);
}

function pointSegmentDistance(p: NestPoint, a: NestPoint, b: NestPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 <= EPS) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

function polygonDistance(a: NestPoint[], b: NestPoint[]): number {
  let min = Infinity;
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i];
    const a2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      const b1 = b[j];
      const b2 = b[(j + 1) % b.length];
      if (segmentsProperlyCross(a1, a2, b1, b2) || onSegment(a1, a2, b1) || onSegment(b1, b2, a1)) return 0;
      min = Math.min(
        min,
        pointSegmentDistance(a1, b1, b2),
        pointSegmentDistance(a2, b1, b2),
        pointSegmentDistance(b1, a1, a2),
        pointSegmentDistance(b2, a1, a2),
      );
    }
  }
  return min;
}

function candidateTranslations(
  variant: NestPoint[],
  placed: Placement[],
  margin: number,
  gap: number,
): NestPoint[] {
  const vb = bounds(variant);
  const candidates: NestPoint[] = [{ x: margin - vb.minX, y: margin - vb.minY }];

  for (const placement of placed) {
    const pb = bounds(placement.points);
    const yAligned = [pb.minY - vb.minY, pb.maxY - vb.maxY, margin - vb.minY];
    const xAligned = [pb.minX - vb.minX, pb.maxX - vb.maxX, margin - vb.minX];

    for (const y of yAligned) {
      candidates.push({ x: pb.maxX + gap - vb.minX, y });
      candidates.push({ x: pb.minX - gap - vb.maxX, y });
    }
    for (const x of xAligned) {
      candidates.push({ x, y: pb.maxY + gap - vb.minY });
      candidates.push({ x, y: pb.minY - gap - vb.maxY });
    }

    for (const p of placement.points) {
      for (const v of variant) {
        candidates.push({ x: p.x - v.x, y: p.y - v.y });
      }
    }
  }

  const seen = new Set<string>();
  return candidates.filter(candidate => {
    const key = `${candidate.x.toFixed(6)},${candidate.y.toFixed(6)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function autoNestPolygon(base: NestPoint[], options: NestOptions): Placement[] {
  if (base.length < 3 || options.count <= 0 || options.sheetWidth <= 0 || options.sheetHeight <= 0) return [];

  const margin = Math.max(0, options.margin ?? 0);
  const gap = Math.max(0, options.gap ?? 0);
  const rotations = options.rotations?.length ? options.rotations : [0];
  const placed: Placement[] = [];
  const variants = rotations.map(rotation => ({ rotation, points: rotate(base, rotation) }));

  for (let n = 0; n < options.count; n++) {
    let best: Placement | undefined;
    let bestScore = Infinity;

    for (const variant of variants) {
      for (const candidate of candidateTranslations(variant.points, placed, margin, gap)) {
        const points = translate(variant.points, candidate.x, candidate.y);
        const b = bounds(points);
        if (b.minX < margin - EPS || b.minY < margin - EPS ||
            b.maxX > options.sheetWidth - margin + EPS ||
            b.maxY > options.sheetHeight - margin + EPS) continue;

        const collision = placed.some(p =>
          polygonsOverlap(points, p.points) || (gap > 0 && polygonDistance(points, p.points) < gap - EPS)
        );
        if (collision) continue;

        const maxX = Math.max(b.maxX, ...placed.map(p => bounds(p.points).maxX));
        const maxY = Math.max(b.maxY, ...placed.map(p => bounds(p.points).maxY));
        const usedW = maxX - margin;
        const usedH = maxY - margin;
        const score = usedW * usedH + b.minY * 0.01 + b.minX * 0.001;
        if (score < bestScore) {
          bestScore = score;
          best = { x: candidate.x, y: candidate.y, rotation: variant.rotation, points };
        }
      }
    }

    if (!best) break;
    placed.push(best);
  }

  return placed;
}

function canonical(s: Segment, tol: number): Segment {
  const a = (s.a.x < s.b.x || (Math.abs(s.a.x - s.b.x) <= tol && s.a.y <= s.b.y)) ? s.a : s.b;
  return { a, b: a === s.a ? s.b : s.a };
}

function samePoint(a: NestPoint, b: NestPoint, tolerance: number): boolean {
  return dist(a, b) <= tolerance;
}

export function uniqueCommonLineSegments(segments: Segment[], tolerance = 0.03): Segment[] {
  const out: Segment[] = [];
  outer: for (const raw of segments) {
    const s = canonical(raw, tolerance);
    for (const existing of out) {
      const e = canonical(existing, tolerance);
      if (samePoint(s.a, e.a, tolerance) && samePoint(s.b, e.b, tolerance)) continue outer;
    }
    out.push(s);
  }
  return out;
}

export function polygonSegments(points: NestPoint[]): Segment[] {
  return points.map((p, i) => ({ a: p, b: points[(i + 1) % points.length] }));
}
