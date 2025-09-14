import type { Point, EdgeSample } from '../types';
import { utils } from './utils';
import { CONSTANTS } from './constants';

const { deg2rad } = utils;
const { SAMPLING } = CONSTANTS;

// Shared validation: radius must be finite, > 0, chord must be > 0,
// and the circle radius must be at least half the chord length.
function isValidRadiusForChord(radius: number, chord: number): boolean {
  return Number.isFinite(radius) && radius > 0 && chord > 0 && radius >= chord / 2;
}

function regularPolygonVertices(n: number, radius: number): Point[] {
  const verts: Point[] = [];
  const startAngle = -Math.PI / 2;
  const step = (2 * Math.PI) / n;
  for (let i = 0; i < n; i++) {
    const a = startAngle + i * step;
    verts.push({ x: radius * Math.cos(a), y: radius * Math.sin(a) });
  }
  return verts;
}

function starVertices(outerRadius: number, rootAngle: number = 128): Point[] {
  const verts: Point[] = [];
  
  // Creates a 5-pointed star with configurable root angles
  // 
  // Mathematical relationship:
  // - 5 outer points (tips) at radius R, separated by 72° (360°/5)
  // - 5 inner points (roots) at radius r, with obtuse angle = rootAngle
  // - Acute angle at tips = 180° - rootAngle
  //
  // From the geometry of the isosceles triangle formed by a tip and its two adjacent roots:
  // tan((180° - rootAngle)/2) = (r * sin(36°)) / (R - r * cos(36°))
  //
  // Solving for inner radius: r = R * tan(halfAcute) / (sin(36°) + tan(halfAcute) * cos(36°))
  
  const acuteAngle = 180 - rootAngle; // Acute angle at tips in degrees
  const halfAcute = (acuteAngle / 2) * Math.PI / 180; // Half of acute angle in radians
  const tan_half_acute = Math.tan(halfAcute);
  
  const sin36 = Math.sin(36 * Math.PI / 180);
  const cos36 = Math.cos(36 * Math.PI / 180);
  
  const innerRadius = outerRadius * tan_half_acute / (sin36 + tan_half_acute * cos36);
  
  const startAngle = -Math.PI / 2; // Start at top
  
  for (let i = 0; i < 5; i++) {
    // Add outer point (star tip)
    const outerAngle = startAngle + i * (2 * Math.PI / 5);
    verts.push({ 
      x: outerRadius * Math.cos(outerAngle), 
      y: outerRadius * Math.sin(outerAngle) 
    });
    
    // Add inner point (between star tips)
    const innerAngle = startAngle + i * (2 * Math.PI / 5) + Math.PI / 5;
    verts.push({ 
      x: innerRadius * Math.cos(innerAngle), 
      y: innerRadius * Math.sin(innerAngle) 
    });
  }
  
  return verts;
}

function edgeMidpoint(a: Point, b: Point): Point { 
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; 
}

function outwardNormal(a: Point, b: Point): Point {
  const dx = b.x - a.x; 
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dy / len, y: -dx / len };
}

// Removed unused quadratic Bézier helpers and path generator

// Helper: compute arc center on the outward side of edge a->b for a given radius.
function computeArcCenterOutward(a: Point, b: Point, radius: number): { c: Point | null; largeArcFlag: number; sweepFlag: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (!isValidRadiusForChord(radius, d)) {
    return { c: null, largeArcFlag: 0, sweepFlag: 0 };
  }
  const halfChord = d / 2;
  // Distance from chord midpoint to circle center
  const h = Math.sqrt(Math.max(0, radius * radius - halfChord * halfChord));
  const m = edgeMidpoint(a, b);
  // Base normal (we'll resolve true outward by comparing distance to origin)
  const nrm = outwardNormal(a, b);
  const cPlus = { x: m.x + nrm.x * h, y: m.y + nrm.y * h };
  const cMinus = { x: m.x - nrm.x * h, y: m.y - nrm.y * h };
  // Heuristic: polygon is centered at origin in our geometry; outward center is farther from origin
  const rPlus = Math.hypot(cPlus.x, cPlus.y);
  const rMinus = Math.hypot(cMinus.x, cMinus.y);
  const c = (rPlus >= rMinus) ? cPlus : cMinus;

  // For circular arcs (rx=ry) with rotation=0, choosing largeArcFlag=0 (minor arc)
  // and sweepFlag=1 selects the center on the +normal side (outward) per SVG's
  // center parameterization (sign determined by fA==fS). This ensures outward bulge.
  const largeArcFlag = 0;
  const sweepFlag = 1;
  return { c, largeArcFlag, sweepFlag };
}

// Variant: choose center based on a provided polygon centroid.
// Returns center on the side OPPOSITE the centroid for an outward bulge
// (i.e., farther from centroid). Useful when panel is not perfectly centered at origin.
// Removed unused centroid-based arc center helper

// Shared: compute parameters for an inset arc parallel to edge a->b
// using base circular arc radius (R) and an inward seam offset (s).
// For outward-bulging edges, inward means R' = R + s (farther from center).
export function getInsetArcParams(
  a: Point,
  b: Point,
  baseRadius: number,
  seamOffset: number
): { valid: boolean; c: Point; r: number; angA: number; dAng: number } {
  const dx = b.x - a.x, dy = b.y - a.y;
  const chord = Math.hypot(dx, dy);
  if (!isValidRadiusForChord(baseRadius, chord)) {
    return { valid: false, c: { x: 0, y: 0 }, r: 0, angA: 0, dAng: 0 };
  }
  // Derive the base arc's center using the exact same SVG-flag semantics
  // as the outline path (minor arc, CCW). This guarantees we stay on the
  // outward-bulging side of the chord for any valid radius.
  const base = getSvgCircularArcParams(a, b, baseRadius, 0, 1);
  if (!base.valid) return { valid: false, c: { x: 0, y: 0 }, r: 0, angA: 0, dAng: 0 };
  const c = base.c;
  const angA = Math.atan2(a.y - c.y, a.x - c.x);
  const angB = Math.atan2(b.y - c.y, b.x - c.x);
  let dAng = angB - angA;
  while (dAng <= -Math.PI) dAng += 2 * Math.PI;
  while (dAng > Math.PI) dAng -= 2 * Math.PI;
  // Inward offset for an outward-bulging edge increases radius (move away from center)
  const rRaw = baseRadius + seamOffset;
  // If negative seam makes radius too small, invalidate so caller can fall back
  if (rRaw < chord / 2 + 1e-6) {
    return { valid: false, c: { x: 0, y: 0 }, r: 0, angA: 0, dAng: 0 };
  }
  const r = Math.max(0.1, rRaw);
  return { valid: true, c, r, angA, dAng };
}

// Compute center-parameterization matching SVG 'A' arc flags for circular arcs (rx=ry, rotation=0)
export function getSvgCircularArcParams(
  a: Point,
  b: Point,
  r: number,
  largeArcFlag: 0 | 1,
  sweepFlag: 0 | 1
): { valid: boolean; c: Point; r: number; angA: number; dAng: number } {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (!isValidRadiusForChord(r, d)) {
    return { valid: false, c: { x: 0, y: 0 }, r: 0, angA: 0, dAng: 0 };
  }
  const m = edgeMidpoint(a, b);
  const nrm = outwardNormal(a, b);
  const h = Math.sqrt(Math.max(0, r * r - (d / 2) * (d / 2)));
  const candidates = [
    { x: m.x + nrm.x * h, y: m.y + nrm.y * h },
    { x: m.x - nrm.x * h, y: m.y - nrm.y * h },
  ];
  function paramsFor(c: Point) {
    const ang0 = Math.atan2(a.y - c.y, a.x - c.x);
    const ang1 = Math.atan2(b.y - c.y, b.x - c.x);
    let dPos = ang1 - ang0;
    while (dPos < 0) dPos += 2 * Math.PI;
    while (dPos >= 2 * Math.PI) dPos -= 2 * Math.PI;
    return { c, ang0, dPos };
  }
  const p0 = paramsFor(candidates[0]);
  const p1 = paramsFor(candidates[1]);
  const pick = (pp: { ang0: number; dPos: number }) => {
    if (sweepFlag === 1) {
      const isMinor = pp.dPos <= Math.PI + 1e-9;
      return (largeArcFlag === 0) ? isMinor : !isMinor;
    } else {
      const isMinorCW = (2 * Math.PI - pp.dPos) <= Math.PI + 1e-9; // CW minor iff CCW is major
      return (largeArcFlag === 0) ? isMinorCW : !isMinorCW;
    }
  };
  const use0 = pick(p0);
  const chosen = use0 ? p0 : p1;
  let dAng: number;
  if (sweepFlag === 1) {
    dAng = (largeArcFlag === 0) ? chosen.dPos : chosen.dPos - 2 * Math.PI; // CCW
  } else {
    const cw = 2 * Math.PI - chosen.dPos;
    dAng = (largeArcFlag === 0) ? -cw : -(2 * Math.PI - cw); // CW negative
  }
  return { valid: true, c: chosen.c, r, angA: chosen.ang0, dAng };
}

function circularArcPath(verts: Point[], radius: number): string {
  const n = verts.length; 
  if (n < 3) return '';
  let dstr = '';
  for (let i = 0; i < n; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % n];
    if (i === 0) dstr += `M ${a.x.toFixed(3)} ${a.y.toFixed(3)} `;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const chord = Math.hypot(dx, dy);
  if (!isValidRadiusForChord(radius, chord)) {
      // Straight fallback if radius invalid for this chord
      dstr += `L ${b.x.toFixed(3)} ${b.y.toFixed(3)} `;
      continue;
    }

    const { sweepFlag, largeArcFlag } = computeArcCenterOutward(a, b, radius);
    dstr += `A ${radius.toFixed(3)} ${radius.toFixed(3)} 0 ${largeArcFlag} ${sweepFlag} ${b.x.toFixed(3)} ${b.y.toFixed(3)} `;
  }
  dstr += 'Z';
  return dstr;
}

// Removed unused quadratic sampling helper

function approxArcEdgeSamples(a: Point, b: Point, radius: number, samples: number = SAMPLING.CURVE_SAMPLES_DEFAULT): EdgeSample[] {
  const pts: EdgeSample[] = [];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (!isValidRadiusForChord(radius, d)) {
    // Fallback to straight line sampling - but still apply proper normals for seam offset
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const x = a.x + t * (b.x - a.x);
      const y = a.y + t * (b.y - a.y);
      // For seam offset, normal should point inward (toward polygon center)
      // For a polygon centered at origin, inward means toward (0,0)
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;  // Left-hand normal (inward for clockwise polygon)
      const ny = dx / len;
      pts.push({ p: { x, y }, t, n: { x: nx, y: ny } });
    }
    return pts;
  }

  const { c } = computeArcCenterOutward(a, b, radius);
  if (!c) {
    // Shouldn't happen due to checks above, but keep safe fallback
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const x = a.x + t * (b.x - a.x);
      const y = a.y + t * (b.y - a.y);
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      pts.push({ p: { x, y }, t, n: { x: nx, y: ny } });
    }
    return pts;
  }

  const angA = Math.atan2(a.y - c.y, a.x - c.x);
  const angB = Math.atan2(b.y - c.y, b.x - c.x);
  // Shortest signed angle from A to B
  let dAng = angB - angA;
  while (dAng <= -Math.PI) dAng += 2 * Math.PI;
  while (dAng > Math.PI) dAng -= 2 * Math.PI;

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const theta = angA + dAng * t;
    const px = c.x + radius * Math.cos(theta);
    const py = c.y + radius * Math.sin(theta);

    // Normal pointing inward (away from center) relative to the panel area for outward bulge.
    // Since the center for outward-bulging arcs lies outside the panel, inward is opposite radial.
    const nx = (c.x - px) / radius;
    const ny = (c.y - py) / radius;

    pts.push({ p: { x: px, y: py }, t, n: { x: nx, y: ny } });
  }
  return pts;
}

function centerVertices(verts: Point[]): Point[] {
  let cx = 0, cy = 0; 
  for (const v of verts) { 
    cx += v.x; 
    cy += v.y; 
  }
  cx /= verts.length; 
  cy /= verts.length;
  return verts.map(v => ({ x: v.x - cx, y: v.y - cy }));
}

function truncatedHexagonVertices(longSide: number, shortSide: number): Point[] {
  const dirs = [0, 60, 120, 180, 240, 300].map(deg2rad);
  const lens = [longSide, shortSide, longSide, shortSide, longSide, shortSide];
  let x = 0, y = 0; 
  const verts: Point[] = [{ x, y }];
  for (let i = 0; i < 5; i++) { 
    x += lens[i] * Math.cos(dirs[i]); 
    y += lens[i] * Math.sin(dirs[i]); 
    verts.push({ x, y }); 
  }
  return centerVertices(verts);
}

// Removed unused curve radius calculator

export const geometry = {
  regularPolygonVertices,
  starVertices,
  edgeMidpoint,
  outwardNormal,
  circularArcPath,
  approxArcEdgeSamples,
  centerVertices,
  truncatedHexagonVertices,
  computeArcCenterOutward,
  getInsetArcParams,
  getSvgCircularArcParams,
};

window.FB = window.FB || {};
window.FB.geometry = geometry;
