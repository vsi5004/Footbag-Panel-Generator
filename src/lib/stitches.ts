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
  edgeInclude: ((i: number) => boolean) | null = null,
  starRootOffset: number = -1.5,
  cornerStitchSpacing: boolean = false,
  cornerStitchDistance: number = 3
): Point[] {
  const n = verts.length; 
  const out: Point[] = [];
  
  // Detect if this is a star shape (10 vertices alternating between outer and inner)
  const isStar = n === 10;
  
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
    
    // For stars, apply different corner margins based on corner type
    let cmStart = cornerMargin; // margin at vertex i (start of edge)
    let cmEnd = cornerMargin;   // margin at vertex (i+1) (end of edge)
    
    if (isStar) {
      // Even indices (0,2,4,6,8) are outer points (sharp), odd indices (1,3,5,7,9) are inner points (roots)
      const startIsOuterPoint = i % 2 === 0;
      const endIsOuterPoint = ((i + 1) % n) % 2 === 0;
      
      // Apply larger margin at sharp points, negative margin at roots to extend past vertex
      cmStart = startIsOuterPoint ? cornerMargin * 2.0 : -cornerMargin * Math.abs(starRootOffset); // User-controlled negative margin extends past roots
      cmEnd = endIsOuterPoint ? cornerMargin * 2.0 : -cornerMargin * Math.abs(starRootOffset);     // User-controlled negative margin extends past roots
    }
    
    // Use asymmetric margins - different at each end of the edge
    // Allow negative margins for star roots, but constrain positive margins
    if (isStar) {
      // For stars, allow negative margins at roots but constrain positive margins at tips
      const startIsOuterPoint = i % 2 === 0;
      const endIsOuterPoint = ((i + 1) % n) % 2 === 0;
      
      if (startIsOuterPoint) {
        cmStart = Math.max(0, Math.min(cmStart, Math.max(0, edgeLen / 2 - 0.1)));
      }
      // else: allow negative margin for roots (no constraint)
      
      if (endIsOuterPoint) {
        cmEnd = Math.max(0, Math.min(cmEnd, Math.max(0, edgeLen / 2 - 0.1)));
      }
      // else: allow negative margin for roots (no constraint)
    } else {
      // For non-stars, use original logic with non-negative constraints
      cmStart = Math.max(0, Math.min(cmStart, Math.max(0, edgeLen / 2 - 0.1)));
      cmEnd = Math.max(0, Math.min(cmEnd, Math.max(0, edgeLen / 2 - 0.1)));
    }
    
    const usable = Math.max(0, edgeLen - cmStart - cmEnd);
    // With custom corner stitch control available, allow much more generous spacing
    const allowable = (usable / (Math.max(1, countPerSide) + 1)) * 2.5;
    const spacing = Math.min(Math.max(0.1, prefSpacing), allowable);
    
    if (countPerSide <= 0 || spacing <= 0 || usable <= 0) continue;
    
    // Calculate positions for each stitch on this edge
    if (cornerStitchSpacing && countPerSide >= 2) {
      // For stars, only apply corner spacing at tips, not roots
      let applyCornerSpacingStart = true;
      let applyCornerSpacingEnd = true;
      
      if (isStar) {
        // In a 10-vertex star: even indices (0,2,4,6,8) are outer tips, odd indices (1,3,5,7,9) are roots
        const startVertexIndex = i;
        const endVertexIndex = (i + 1) % n;
        
        // Only apply corner spacing if the vertex is an outer tip (even index)
        applyCornerSpacingStart = startVertexIndex % 2 === 0; // Start vertex is a tip
        applyCornerSpacingEnd = endVertexIndex % 2 === 0;     // End vertex is a tip
      }
      
      // Use corner distance to control spacing BETWEEN corner stitches and their neighbors
      const cornerSpacingBetweenHoles = cornerStitchDistance;
      const firstStitchSpacing = applyCornerSpacingStart ? cornerSpacingBetweenHoles : spacing;
      const lastStitchSpacing = applyCornerSpacingEnd ? cornerSpacingBetweenHoles : spacing;
      
      if (countPerSide === 2) {
        // Only 2 stitches: use appropriate spacing based on star geometry
        const usedSpacing = (applyCornerSpacingStart || applyCornerSpacingEnd) ? 
          Math.min(firstStitchSpacing, lastStitchSpacing) : spacing;
        const totalUsableSpace = usable;
        const remainingSpace = totalUsableSpace - usedSpacing;
        const startOffset = remainingSpace / 2;
        
        const positions = [
          cmStart + startOffset,
          cmStart + startOffset + usedSpacing
        ];
        
        for (let k = 0; k < positions.length; k++) {
          const target = positions[k];
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
      } else {
        // 3+ stitches: first and last gaps use appropriate spacing based on star geometry
        const middleStitchCount = countPerSide - 2;
        
        // Calculate space needed for corner gaps (may be different for start vs end)
        const firstGapSpace = firstStitchSpacing;
        const lastGapSpace = lastStitchSpacing;
        const cornerGapsSpace = firstGapSpace + lastGapSpace;
        const remainingSpaceForMiddle = usable - cornerGapsSpace;
        
        if (remainingSpaceForMiddle > 0 && middleStitchCount > 0) {
          // Use the original global spacing for middle stitches
          const middleSpacing = spacing;
          const totalMiddleSpace = middleSpacing * (middleStitchCount - 1); // gaps between middle stitches only
          
          // Check if we have enough space for middle stitches with their preferred spacing
          if (totalMiddleSpace <= remainingSpaceForMiddle) {
            // We have enough space - center the middle stitches
            const extraSpace = remainingSpaceForMiddle - totalMiddleSpace;
            const paddingAroundMiddle = extraSpace / 2;
            
            // Generate all stitch positions
            const positions: number[] = [];
            
            // First stitch
            positions.push(cmStart + paddingAroundMiddle);
            
            // Second stitch (uses first gap spacing - corner or normal based on star geometry)
            positions.push(positions[0] + firstStitchSpacing);
            
            // Middle stitches (use global spacing)
            for (let k = 1; k < middleStitchCount; k++) {
              positions.push(positions[positions.length - 1] + middleSpacing);
            }
            
            // Last stitch (uses last gap spacing - corner or normal based on star geometry)
            positions.push(positions[positions.length - 1] + lastStitchSpacing);
            
            // Place stitches at calculated positions
            for (const target of positions) {
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
          } else {
            // Not enough space for global spacing - fall back to uniform spacing
            const start = cmStart + (usable - spacing * (countPerSide + 1)) / 2 + spacing;
            
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
        } else {
          // Fall back to uniform spacing if corner spacing doesn't leave enough room
          const start = cmStart + (usable - spacing * (countPerSide + 1)) / 2 + spacing;
          
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
      }
    } else {
      // Use uniform spacing (original logic)
      const start = cmStart + (usable - spacing * (countPerSide + 1)) / 2 + spacing;
      
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
  }
  return out;
}

function computeAllowableSpacing(
  verts: Point[], 
  depth: number, 
  countPerSide: number, 
  cornerMargin: number, 
  samplesPerEdge: number = SAMPLING.EDGE_SAMPLES_DEFAULT, 
  edgeInclude: ((i: number) => boolean) | null = null,
  starRootOffset: number = -1.5
): number {
  const n = verts.length; 
  let minAllowable = Infinity;
  
  // Detect if this is a star shape
  const isStar = n === 10;
  
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
    
    // Apply star-specific corner margin logic with asymmetric margins
    let cmStart = cornerMargin;
    let cmEnd = cornerMargin;
    
    if (isStar) {
      const startIsOuterPoint = i % 2 === 0;
      const endIsOuterPoint = ((i + 1) % n) % 2 === 0;
      
      // Calculate margins: larger positive margins at outer points, negative margins at roots
      cmStart = startIsOuterPoint ? Math.max(0, Math.min(cornerMargin * 2.0, Math.max(0, edgeLen / 2 - 0.1))) : -cornerMargin * Math.abs(starRootOffset);
      cmEnd = endIsOuterPoint ? Math.max(0, Math.min(cornerMargin * 2.0, Math.max(0, edgeLen / 2 - 0.1))) : -cornerMargin * Math.abs(starRootOffset);
    } else {
      // For non-stars, apply standard positive margin constraints
      cmStart = Math.max(0, Math.min(cmStart, Math.max(0, edgeLen / 2 - 0.1)));
      cmEnd = Math.max(0, Math.min(cmEnd, Math.max(0, edgeLen / 2 - 0.1)));
    }
    
    const usable = Math.max(0, edgeLen - cmStart - cmEnd);
    // With custom corner stitch control available, we can be very generous with spacing
    // Allow up to 2.5x more spacing than the strict mathematical minimum
    const allowable = (usable / (Math.max(1, countPerSide) + 1)) * 2.5;
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
