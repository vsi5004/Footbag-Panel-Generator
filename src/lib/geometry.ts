import type { Point, EdgeSample } from '../types';
import { utils } from './utils';
import { CONSTANTS } from './constants';

const { deg2rad } = utils;
const { SAMPLING } = CONSTANTS;

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

function quadPoint(a: Point, c: Point, b: Point, t: number): Point {
  const mt = 1 - t;
  const x = mt * mt * a.x + 2 * mt * t * c.x + t * t * b.x;
  const y = mt * mt * a.y + 2 * mt * t * c.y + t * t * b.y;
  return { x, y };
}

function quadTangent(a: Point, c: Point, b: Point, t: number): Point {
  const x = 2 * (1 - t) * (c.x - a.x) + 2 * t * (b.x - c.x);
  const y = 2 * (1 - t) * (c.y - a.y) + 2 * t * (b.y - c.y);
  return { x, y };
}

function quadraticCurvePath(verts: Point[], curveDepth: number): string {
  const n = verts.length; 
  if (n < 3) return '';
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % n];
    const m = edgeMidpoint(a, b);
    const nrm = outwardNormal(a, b);
    const c = { x: m.x + nrm.x * curveDepth, y: m.y + nrm.y * curveDepth };
    if (i === 0) d += `M ${a.x.toFixed(3)} ${a.y.toFixed(3)} `;
    d += `Q ${c.x.toFixed(3)} ${c.y.toFixed(3)} ${b.x.toFixed(3)} ${b.y.toFixed(3)} `;
  }
  d += 'Z';
  return d;
}

function approxEdgeSamples(a: Point, b: Point, depth: number, samples: number = SAMPLING.CURVE_SAMPLES_DEFAULT): EdgeSample[] {
  const m = edgeMidpoint(a, b);
  const nrm = outwardNormal(a, b);
  const c = { x: m.x + nrm.x * depth, y: m.y + nrm.y * depth };
  const pts: EdgeSample[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = quadPoint(a, c, b, t);
    const tan = quadTangent(a, c, b, t);
    const len = Math.hypot(tan.x, tan.y) || 1;
    const nx = -tan.y / len; 
    const ny = tan.x / len;
    pts.push({ p, t, n: { x: nx, y: ny } });
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

export const geometry = {
  regularPolygonVertices,
  starVertices,
  edgeMidpoint,
  outwardNormal,
  quadPoint,
  quadTangent,
  quadraticCurvePath,
  approxEdgeSamples,
  centerVertices,
  truncatedHexagonVertices,
};

window.FB = window.FB || {};
window.FB.geometry = geometry;
