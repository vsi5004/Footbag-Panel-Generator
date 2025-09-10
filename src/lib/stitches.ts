import type { Point } from '../types';
import { utils } from './utils';
import { geometry } from './geometry';
import { CONSTANTS } from './constants';

const { clamp } = utils;
const G = geometry;
const { SAMPLING } = CONSTANTS;

function stitchPositions(
  verts: Point[], 
  depth: number, 
  countPerSide: number, 
  offset: number, 
  prefSpacing: number, 
  cornerMargin: number, 
  samplesPerEdge: number = SAMPLING.EDGE_SAMPLES_DEFAULT, 
  edgeInclude: ((i: number) => boolean) | null = null
): Point[] {
  const n = verts.length; 
  const out: Point[] = [];
  
  for (let i = 0; i < n; i++) {
    if (edgeInclude && !edgeInclude(i)) continue;
    
    const a = verts[i];
    const b = verts[(i + 1) % n];
    const samples = G.approxEdgeSamples(a, b, depth, samplesPerEdge);
    const cum = [0]; 
    let edgeLen = 0;
    
    for (let j = 1; j < samples.length; j++) {
      const p0 = samples[j - 1].p; 
      const p1 = samples[j].p;
      edgeLen += Math.hypot(p1.x - p0.x, p1.y - p0.y); 
      cum.push(edgeLen);
    }
    
    const cm = Math.max(0, Math.min(cornerMargin, Math.max(0, edgeLen / 2 - 0.1)));
    const usable = Math.max(0, edgeLen - 2 * cm);
    const allowable = usable / (Math.max(1, countPerSide) + 1);
    const spacing = Math.min(Math.max(0.1, prefSpacing), allowable);
    
    if (countPerSide <= 0 || spacing <= 0 || usable <= 0) continue;
    
    const start = cm + (usable - spacing * (countPerSide + 1)) / 2 + spacing;
    
    for (let k = 0; k < countPerSide; k++) {
      const target = start + k * spacing;
      let idx = 0; 
      while (idx < cum.length && cum[idx] < target) idx++;
      
      const j = clamp(idx, 1, cum.length - 1);
      const t = (target - cum[j - 1]) / Math.max(1e-6, cum[j] - cum[j - 1]);
      const P0 = samples[j - 1]; 
      const P1 = samples[j];
      
      const px = P0.p.x + (P1.p.x - P0.p.x) * t; 
      const py = P0.p.y + (P1.p.y - P0.p.y) * t;
      
      if (P0.n && P1.n) {
        const nx = P0.n.x + (P1.n.x - P0.n.x) * t; 
        const ny = P0.n.y + (P1.n.y - P0.n.y) * t;
        const nlen = Math.hypot(nx, ny) || 1;
        out.push({ x: px + (nx / nlen) * offset, y: py + (ny / nlen) * offset });
      } else {
        out.push({ x: px, y: py });
      }
    }
  }
  return out;
}

function computeAllowableSpacing(
  verts: Point[], 
  depth: number, 
  countPerSide: number, 
  cornerMargin: number, 
  samplesPerEdge: number = SAMPLING.EDGE_SAMPLES_DEFAULT, 
  edgeInclude: ((i: number) => boolean) | null = null
): number {
  const n = verts.length; 
  let minAllowable = Infinity;
  
  for (let i = 0; i < n; i++) {
    if (edgeInclude && !edgeInclude(i)) continue;
    
    const a = verts[i]; 
    const b = verts[(i + 1) % n];
    const samples = G.approxEdgeSamples(a, b, depth, samplesPerEdge);
    let edgeLen = 0;
    
    for (let j = 1; j < samples.length; j++) {
      const p0 = samples[j - 1].p, p1 = samples[j].p;
      edgeLen += Math.hypot(p1.x - p0.x, p1.y - p0.y);
    }
    
    const cm = Math.max(0, Math.min(cornerMargin, Math.max(0, edgeLen / 2 - 0.1)));
    const usable = Math.max(0, edgeLen - 2 * cm);
    const allowable = usable / (Math.max(1, countPerSide) + 1);
    if (allowable < minAllowable) minAllowable = allowable;
  }
  
  return Number.isFinite(minAllowable) ? minAllowable : 1;
}

export const stitches = {
  stitchPositions,
  computeAllowableSpacing
};

// For backward compatibility with global window.FB
window.FB = window.FB || {};
window.FB.stitches = stitches;
