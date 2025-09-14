import type { Point } from '../types';
import { utils } from './utils';
import { geometry } from './geometry';
import { CONSTANTS } from './constants';

const { clamp } = utils;
const G = geometry;
const { SAMPLING } = CONSTANTS;

/**
 * Helper function to place a stitch at a specific position along an edge
 */
/**
 * Helper function to place a stitch at a specific position along an edge
 */
function placeStitchAtPosition(
  target: number,
  cumulativeDistances: number[],
  edgeSamples: any[],
  seamOffset: number,
  stitchPoints: Point[]
): void {
  let searchIndex = 0; 
  while (searchIndex < cumulativeDistances.length && cumulativeDistances[searchIndex] < target) searchIndex++;
  
  const segmentIndex = clamp(searchIndex, 1, cumulativeDistances.length - 1);
  const interpolationFactor = (target - cumulativeDistances[segmentIndex - 1]) / Math.max(1e-6, cumulativeDistances[segmentIndex] - cumulativeDistances[segmentIndex - 1]);
  const startSample = edgeSamples[segmentIndex - 1]; 
  const endSample = edgeSamples[segmentIndex];
  
  const interpolatedX = startSample.p.x + (endSample.p.x - startSample.p.x) * interpolationFactor; 
  const interpolatedY = startSample.p.y + (endSample.p.y - startSample.p.y) * interpolationFactor;
  
  if (startSample.n && endSample.n) {
    let normalX = startSample.n.x + (endSample.n.x - startSample.n.x) * interpolationFactor; 
    let normalY = startSample.n.y + (endSample.n.y - startSample.n.y) * interpolationFactor;
    // Ensure inward offset: flip if the normal points roughly away from polygon center (origin)
    const toOriginX = -interpolatedX;
    const toOriginY = -interpolatedY;
    if (normalX * toOriginX + normalY * toOriginY < 0) {
      normalX = -normalX;
      normalY = -normalY;
    }
    const normalLength = Math.hypot(normalX, normalY) || 1;
    stitchPoints.push({ x: interpolatedX + (normalX / normalLength) * seamOffset, y: interpolatedY + (normalY / normalLength) * seamOffset });
  } else {
    stitchPoints.push({ x: interpolatedX, y: interpolatedY });
  }
}

function stitchPositionsByEdge(
  vertices: Point[], 
  curveRadius: number, 
  stitchesPerSide: number, 
  seamOffset: number, 
  preferredSpacing: number, 
  cornerMargin: number, 
  samplesPerEdge: number = SAMPLING.EDGE_SAMPLES_DEFAULT, 
  edgeInclude: ((i: number) => boolean) | null = null,
  starRootOffset: number = -1.5,
  cornerStitchSpacing: boolean = false,
  cornerStitchDistance: number = 3
): Point[][] {
  const vertexCount = vertices.length; 
  const stitchesByEdge: Point[][] = [];
  
  // Detect if this is a star shape (10 vertices alternating between outer and inner)
  const isStar = vertexCount === 10;
  
  for (let i = 0; i < vertexCount; i++) {
    if (edgeInclude && !edgeInclude(i)) {
      // Preserve edge index alignment with optional empty group
      stitchesByEdge.push([]);
      continue;
    }
    
    const startVertex = vertices[i];
    const endVertex = vertices[(i + 1) % vertexCount];
    const edgeSamples = G.approxArcEdgeSamples(startVertex, endVertex, curveRadius, samplesPerEdge);
    const cumulativeDistances = [0]; 
    let totalEdgeLength = 0;
    const currentEdgePoints: Point[] = [];
    
    for (let j = 1; j < edgeSamples.length; j++) {
      const previousPoint = edgeSamples[j - 1].p; 
      const currentPoint = edgeSamples[j].p;
      totalEdgeLength += Math.hypot(currentPoint.x - previousPoint.x, currentPoint.y - previousPoint.y); 
      cumulativeDistances.push(totalEdgeLength);
    }

    // Detect if we can treat this edge as a true circular arc
    const dx = endVertex.x - startVertex.x;
    const dy = endVertex.y - startVertex.y;
    const chord = Math.hypot(dx, dy);
  const hasCurvedArc = isFinite(curveRadius) && curveRadius > 0 && curveRadius >= chord / 2;
    // Precompute inset arc parameters for curved edges (parallel path at R+seamOffset)
    let arcCenter: Point | null = null;
    let angA = 0, dAng = 0;
    let insetR = 0, arcLenInset = 0;
  if (hasCurvedArc) {
      // Use exact concentric inset arc parameters to keep a true constant offset (seam allowance)
      const p = (window.FB.geometry as any).getInsetArcParams(startVertex, endVertex, curveRadius, seamOffset);
      if (p && p.valid) {
        arcCenter = p.c as Point;
        angA = p.angA;
        dAng = p.dAng;
        insetR = p.r;
        arcLenInset = Math.abs(dAng) * insetR;
      } else {
        // Invalid inset (e.g., negative seam made radius < chord/2); treat this edge as straight for holes
        // Keep arcCenter null so we use sampling + signed normal offset below
      }
    }
    
    // For stars, apply different corner margins based on corner type
  let startMargin = cornerMargin; // margin at vertex i (start of edge)
  let endMargin = cornerMargin;   // margin at vertex (i+1) (end of edge)
    
  if (isStar) {
      // Even indices (0,2,4,6,8) are outer points (sharp), odd indices (1,3,5,7,9) are inner points (roots)
      const startIsOuterPoint = i % 2 === 0;
      const endIsOuterPoint = ((i + 1) % vertexCount) % 2 === 0;
      
      // Apply larger margin at sharp points, negative margin at roots to extend past vertex
      startMargin = startIsOuterPoint ? cornerMargin * 2.0 : -cornerMargin * Math.abs(starRootOffset); // User-controlled negative margin extends past roots
      endMargin = endIsOuterPoint ? cornerMargin * 2.0 : -cornerMargin * Math.abs(starRootOffset);     // User-controlled negative margin extends past roots
    }
    
    // Use asymmetric margins - different at each end of the edge
    // Allow negative margins for star roots, but constrain positive margins
    if (isStar) {
      // For stars, allow negative margins at roots but constrain positive margins at tips
      const startIsOuterPoint = i % 2 === 0;
      const endIsOuterPoint = ((i + 1) % vertexCount) % 2 === 0;
      
      if (startIsOuterPoint) {
        startMargin = Math.max(0, Math.min(startMargin, Math.max(0, totalEdgeLength / 2 - 0.1)));
      }
      // else: allow negative margin for roots (no constraint)
      
      if (endIsOuterPoint) {
        endMargin = Math.max(0, Math.min(endMargin, Math.max(0, totalEdgeLength / 2 - 0.1)));
      }
      // else: allow negative margin for roots (no constraint)
    } else {
      // For non-stars, use original logic with non-negative constraints
      const halfLen = (hasCurvedArc ? arcLenInset : totalEdgeLength) / 2;
      startMargin = Math.max(0, Math.min(startMargin, Math.max(0, halfLen - 0.1)));
      endMargin = Math.max(0, Math.min(endMargin, Math.max(0, halfLen - 0.1)));
    }
    
  const effectiveEdgeLength = hasCurvedArc ? arcLenInset : totalEdgeLength;
  const usableLength = Math.max(0, effectiveEdgeLength - startMargin - endMargin);
    // With custom corner stitch control available, allow much more generous spacing
    const maxAllowableSpacing = (usableLength / (Math.max(1, stitchesPerSide) + 1)) * 2.5;
    const actualSpacing = Math.min(Math.max(0.1, preferredSpacing), maxAllowableSpacing);
    
    if (stitchesPerSide <= 0 || actualSpacing <= 0 || usableLength <= 0) continue;

    // Helper: place stitches along a circular arc using inset radius (true concentric/parallel)
  const placeAlongInsetArc = (absoluteTargets: number[]) => {
      if (!arcCenter) return;
      for (const target of absoluteTargets) {
        const t = arcLenInset > 0 ? (target / arcLenInset) : 0; // 0..1 along inset arc
        const theta = angA + dAng * t;
        const x = arcCenter.x + insetR * Math.cos(theta);
        const y = arcCenter.y + insetR * Math.sin(theta);
        currentEdgePoints.push({ x, y });
      }
    };
    
  // Calculate positions for each stitch on this edge
    if (cornerStitchSpacing && stitchesPerSide >= 2) {
      // For stars, only apply corner spacing at tips, not roots
      let applyCornerSpacingStart = true;
      let applyCornerSpacingEnd = true;
      
      if (isStar) {
        // In a 10-vertex star: even indices (0,2,4,6,8) are outer tips, odd indices (1,3,5,7,9) are roots
        const startVertexIndex = i;
        const endVertexIndex = (i + 1) % vertexCount;
        
        // Only apply corner spacing if the vertex is an outer tip (even index)
        applyCornerSpacingStart = startVertexIndex % 2 === 0; // Start vertex is a tip
        applyCornerSpacingEnd = endVertexIndex % 2 === 0;     // End vertex is a tip
      }
      
      // Use corner distance to control spacing BETWEEN corner stitches and their neighbors
      const cornerSpacingBetweenHoles = cornerStitchDistance;
      const firstStitchSpacing = applyCornerSpacingStart ? cornerSpacingBetweenHoles : actualSpacing;
      const lastStitchSpacing = applyCornerSpacingEnd ? cornerSpacingBetweenHoles : actualSpacing;
      
      if (stitchesPerSide === 2) {
        // Only 2 stitches: use appropriate spacing based on star geometry
  const usedSpacing = (applyCornerSpacingStart || applyCornerSpacingEnd) ? 
          Math.min(firstStitchSpacing, lastStitchSpacing) : actualSpacing;
  const totalUsableSpace = usableLength;
  const remainingSpace = totalUsableSpace - usedSpacing;
        const startOffset = remainingSpace / 2;
        
        const absTargets = [
          startMargin + startOffset,
          startMargin + startOffset + usedSpacing
        ];
        if (hasCurvedArc) {
          placeAlongInsetArc(absTargets);
        } else {
          for (const target of absTargets) {
            placeStitchAtPosition(target, cumulativeDistances, edgeSamples, seamOffset, currentEdgePoints);
          }
        }
      } else {
        // 3+ stitches: first and last gaps use appropriate spacing based on star geometry
        const middleStitchCount = stitchesPerSide - 2;
        
        // Calculate space needed for corner gaps (may be different for start vs end)
        const firstGapSpace = firstStitchSpacing;
        const lastGapSpace = lastStitchSpacing;
        const cornerGapsSpace = firstGapSpace + lastGapSpace;
        const remainingSpaceForMiddle = usableLength - cornerGapsSpace;
        
        if (remainingSpaceForMiddle > 0 && middleStitchCount > 0) {
          // Use the original global spacing for middle stitches
            const middleSpacing = actualSpacing;
          const totalMiddleSpace = middleSpacing * (middleStitchCount - 1); // gaps between middle stitches only
          
          // Check if we have enough space for middle stitches with their preferred spacing
          if (totalMiddleSpace <= remainingSpaceForMiddle) {
            // We have enough space - center the middle stitches
            const extraSpace = remainingSpaceForMiddle - totalMiddleSpace;
            const paddingAroundMiddle = extraSpace / 2;
            
            // Generate all stitch positions
            const stitchPositions: number[] = [];
            
            // First stitch
            stitchPositions.push(startMargin + paddingAroundMiddle);
            
            // Second stitch (uses first gap spacing - corner or normal based on star geometry)
            stitchPositions.push(stitchPositions[0] + firstStitchSpacing);
            
            // Middle stitches (use global spacing)
            for (let k = 1; k < middleStitchCount; k++) {
              stitchPositions.push(stitchPositions[stitchPositions.length - 1] + middleSpacing);
            }
            
            // Last stitch (uses last gap spacing - corner or normal based on star geometry)
            stitchPositions.push(stitchPositions[stitchPositions.length - 1] + lastStitchSpacing);
            
            // Place stitches at calculated positions
            if (arcCenter) {
              const absTargets = stitchPositions; // already absolute distances from 0
              placeAlongInsetArc(absTargets);
            } else {
              for (const target of stitchPositions) {
                placeStitchAtPosition(target, cumulativeDistances, edgeSamples, seamOffset, currentEdgePoints);
              }
            }
          } else {
            // Not enough space for global spacing - fall back to uniform spacing
            const start = startMargin + (usableLength - actualSpacing * (stitchesPerSide + 1)) / 2 + actualSpacing;
            
            for (let k = 0; k < stitchesPerSide; k++) {
              const target = start + k * actualSpacing;
              if (arcCenter) {
                placeAlongInsetArc([target]);
              } else {
                placeStitchAtPosition(target, cumulativeDistances, edgeSamples, seamOffset, currentEdgePoints);
              }
            }
          }
        } else {
          // Fall back to uniform spacing if corner spacing doesn't leave enough room
          const start = startMargin + (usableLength - actualSpacing * (stitchesPerSide + 1)) / 2 + actualSpacing;
          
          for (let k = 0; k < stitchesPerSide; k++) {
            const target = start + k * actualSpacing;
            if (arcCenter) {
              placeAlongInsetArc([target]);
            } else {
              placeStitchAtPosition(target, cumulativeDistances, edgeSamples, seamOffset, currentEdgePoints);
            }
          }
        }
      }
    } else {
      // Use uniform spacing (original logic)
      const start = startMargin + (usableLength - actualSpacing * (stitchesPerSide + 1)) / 2 + actualSpacing;
      
      for (let k = 0; k < stitchesPerSide; k++) {
        const target = start + k * actualSpacing;
        if (arcCenter) {
          placeAlongInsetArc([target]);
        } else {
          placeStitchAtPosition(target, cumulativeDistances, edgeSamples, seamOffset, currentEdgePoints);
        }
      }
    }
    stitchesByEdge.push(currentEdgePoints);
  }
  return stitchesByEdge;
}

function stitchPositions(
  vertices: Point[], 
  curveRadius: number, 
  stitchesPerSide: number, 
  seamOffset: number, 
  preferredSpacing: number, 
  cornerMargin: number, 
  samplesPerEdge: number = SAMPLING.EDGE_SAMPLES_DEFAULT, 
  edgeInclude: ((i: number) => boolean) | null = null,
  starRootOffset: number = -1.5,
  cornerStitchSpacing: boolean = false,
  cornerStitchDistance: number = 3
): Point[] {
  const grouped = stitchPositionsByEdge(
    vertices, curveRadius, stitchesPerSide, seamOffset, preferredSpacing, cornerMargin,
    samplesPerEdge, edgeInclude, starRootOffset, cornerStitchSpacing, cornerStitchDistance
  );
  // Flatten
  const flat: Point[] = [];
  for (const edge of grouped) {
    for (const p of edge) flat.push(p);
  }
  return flat;
}

function computeAllowableSpacing(
  vertices: Point[], 
  curveRadius: number, 
  stitchesPerSide: number, 
  cornerMargin: number, 
  samplesPerEdge: number = SAMPLING.EDGE_SAMPLES_DEFAULT, 
  edgeInclude: ((i: number) => boolean) | null = null,
  starRootOffset: number = -1.5
): number {
  const vertexCount = vertices.length; 
  let minAllowable = Infinity;
  
  // Detect if this is a star shape
  const isStar = vertexCount === 10;
  
  for (let i = 0; i < vertexCount; i++) {
    if (edgeInclude && !edgeInclude(i)) continue;
    
    const a = vertices[i]; 
    const b = vertices[(i + 1) % vertexCount];
    const edgeSamples = G.approxArcEdgeSamples(a, b, curveRadius, samplesPerEdge);
    let edgeLen = 0;
    
    for (let j = 1; j < edgeSamples.length; j++) {
      const p0 = edgeSamples[j - 1].p, p1 = edgeSamples[j].p;
      edgeLen += Math.hypot(p1.x - p0.x, p1.y - p0.y);
    }
    
    // If arc is curved, use inset-arc length rather than base samples
    const dx = b.x - a.x, dy = b.y - a.y;
    const chord = Math.hypot(dx, dy);
    const isArc = isFinite(curveRadius) && curveRadius > 0 && curveRadius >= chord / 2;
    if (isArc) {
      const { c } = (window.FB.geometry as any).computeArcCenterOutward(a, b, curveRadius);
      if (c) {
        const insetR = Math.max(0.1, curveRadius + 0); // seam offset not known here; keep base length conservative
        const ang0 = Math.atan2(a.y - c.y, a.x - c.x);
        const ang1 = Math.atan2(b.y - c.y, b.x - c.x);
        let dAng = ang1 - ang0;
        while (dAng <= -Math.PI) dAng += 2 * Math.PI;
        while (dAng > Math.PI) dAng -= 2 * Math.PI;
        edgeLen = Math.abs(dAng) * insetR;
      }
    }

    // Apply star-specific corner margin logic with asymmetric margins
    let startMargin = cornerMargin;
    let endMargin = cornerMargin;
    
    if (isStar) {
      const startIsOuterPoint = i % 2 === 0;
      const endIsOuterPoint = ((i + 1) % vertexCount) % 2 === 0;
      
      // Calculate margins: larger positive margins at outer points, negative margins at roots
      startMargin = startIsOuterPoint ? Math.max(0, Math.min(cornerMargin * 2.0, Math.max(0, edgeLen / 2 - 0.1))) : -cornerMargin * Math.abs(starRootOffset);
      endMargin = endIsOuterPoint ? Math.max(0, Math.min(cornerMargin * 2.0, Math.max(0, edgeLen / 2 - 0.1))) : -cornerMargin * Math.abs(starRootOffset);
    } else {
      // For non-stars, apply standard positive margin constraints
      startMargin = Math.max(0, Math.min(startMargin, Math.max(0, edgeLen / 2 - 0.1)));
      endMargin = Math.max(0, Math.min(endMargin, Math.max(0, edgeLen / 2 - 0.1)));
    }
    
    const usableLength = Math.max(0, edgeLen - startMargin - endMargin);
    // With custom corner stitch control available, we can be very generous with spacing
    // Allow up to 2.5x more spacing than the strict mathematical minimum
    const allowable = (usableLength / (Math.max(1, stitchesPerSide) + 1)) * 2.5;
    if (allowable < minAllowable) minAllowable = allowable;
  }
  
  return Number.isFinite(minAllowable) ? minAllowable : 1;
}

export const stitches = {
  stitchPositionsByEdge,
  stitchPositions,
  computeAllowableSpacing
};

// For backward compatibility with global window.FB
window.FB = window.FB || {};
window.FB.stitches = stitches;
