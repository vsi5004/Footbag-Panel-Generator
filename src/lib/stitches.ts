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
    const normalX = startSample.n.x + (endSample.n.x - startSample.n.x) * interpolationFactor; 
    const normalY = startSample.n.y + (endSample.n.y - startSample.n.y) * interpolationFactor;
    const normalLength = Math.hypot(normalX, normalY) || 1;
    stitchPoints.push({ x: interpolatedX + (normalX / normalLength) * seamOffset, y: interpolatedY + (normalY / normalLength) * seamOffset });
  } else {
    stitchPoints.push({ x: interpolatedX, y: interpolatedY });
  }
}

function stitchPositions(
  vertices: Point[], 
  curveDepth: number, 
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
  const vertexCount = vertices.length; 
  const stitchPoints: Point[] = [];
  
  // Detect if this is a star shape (10 vertices alternating between outer and inner)
  const isStar = vertexCount === 10;
  
  for (let i = 0; i < vertexCount; i++) {
    if (edgeInclude && !edgeInclude(i)) continue;
    
    const startVertex = vertices[i];
    const endVertex = vertices[(i + 1) % vertexCount];
    const edgeSamples = G.approxEdgeSamples(startVertex, endVertex, curveDepth, samplesPerEdge);
    const cumulativeDistances = [0]; 
    let totalEdgeLength = 0;
    
    for (let j = 1; j < edgeSamples.length; j++) {
      const previousPoint = edgeSamples[j - 1].p; 
      const currentPoint = edgeSamples[j].p;
      totalEdgeLength += Math.hypot(currentPoint.x - previousPoint.x, currentPoint.y - previousPoint.y); 
      cumulativeDistances.push(totalEdgeLength);
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
      startMargin = Math.max(0, Math.min(startMargin, Math.max(0, totalEdgeLength / 2 - 0.1)));
      endMargin = Math.max(0, Math.min(endMargin, Math.max(0, totalEdgeLength / 2 - 0.1)));
    }
    
    const usableLength = Math.max(0, totalEdgeLength - startMargin - endMargin);
    // With custom corner stitch control available, allow much more generous spacing
    const maxAllowableSpacing = (usableLength / (Math.max(1, stitchesPerSide) + 1)) * 2.5;
    const actualSpacing = Math.min(Math.max(0.1, preferredSpacing), maxAllowableSpacing);
    
    if (stitchesPerSide <= 0 || actualSpacing <= 0 || usableLength <= 0) continue;
    
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
        
        const stitchPositions = [
          startMargin + startOffset,
          startMargin + startOffset + usedSpacing
        ];
        
        for (let k = 0; k < stitchPositions.length; k++) {
          placeStitchAtPosition(stitchPositions[k], cumulativeDistances, edgeSamples, seamOffset, stitchPoints);
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
            for (const target of stitchPositions) {
              placeStitchAtPosition(target, cumulativeDistances, edgeSamples, seamOffset, stitchPoints);
            }
          } else {
            // Not enough space for global spacing - fall back to uniform spacing
            const start = startMargin + (usableLength - actualSpacing * (stitchesPerSide + 1)) / 2 + actualSpacing;
            
            for (let k = 0; k < stitchesPerSide; k++) {
              const target = start + k * actualSpacing;
              placeStitchAtPosition(target, cumulativeDistances, edgeSamples, seamOffset, stitchPoints);
            }
          }
        } else {
          // Fall back to uniform spacing if corner spacing doesn't leave enough room
          const start = startMargin + (usableLength - actualSpacing * (stitchesPerSide + 1)) / 2 + actualSpacing;
          
          for (let k = 0; k < stitchesPerSide; k++) {
            const target = start + k * actualSpacing;
            placeStitchAtPosition(target, cumulativeDistances, edgeSamples, seamOffset, stitchPoints);
          }
        }
      }
    } else {
      // Use uniform spacing (original logic)
      const start = startMargin + (usableLength - actualSpacing * (stitchesPerSide + 1)) / 2 + actualSpacing;
      
      for (let k = 0; k < stitchesPerSide; k++) {
        const target = start + k * actualSpacing;
        placeStitchAtPosition(target, cumulativeDistances, edgeSamples, seamOffset, stitchPoints);
      }
    }
  }
  return stitchPoints;
}

function computeAllowableSpacing(
  vertices: Point[], 
  curveDepth: number, 
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
    const edgeSamples = G.approxEdgeSamples(a, b, curveDepth, samplesPerEdge);
    let edgeLen = 0;
    
    for (let j = 1; j < edgeSamples.length; j++) {
      const p0 = edgeSamples[j - 1].p, p1 = edgeSamples[j].p;
      edgeLen += Math.hypot(p1.x - p0.x, p1.y - p0.y);
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
  stitchPositions,
  computeAllowableSpacing
};

// For backward compatibility with global window.FB
window.FB = window.FB || {};
window.FB.stitches = stitches;
