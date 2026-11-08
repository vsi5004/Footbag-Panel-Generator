import type { GeometryConfig, GeometryResult, Point } from '../types';
import { geometry } from './geometry';
import { utils } from './utils';

/** Shared regular/truncated polygon construction and orientation. */
export function createPolygonGeometry(config: GeometryConfig): GeometryResult {
  const { nSides, side, hexType, hexLong, hexRatio } = config;

  let verts: Point[];
  let curveScaleR: number;
  let edgeInclude: ((i: number) => boolean) | null = null;

  if (nSides === 6 && hexType === 'truncated') {
    const longSideLength = hexLong;
    const shortSideLength = hexRatio * longSideLength;
    verts = geometry.truncatedHexagonVertices(longSideLength, shortSideLength);
    let sumr = 0;
    for (const v of verts) sumr += Math.hypot(v.x, v.y);
    curveScaleR = sumr / verts.length || longSideLength;
    edgeInclude = (i: number) => i % 2 === 0;
  } else {
    const circumRadius = side / (2 * Math.sin(Math.PI / nSides));
    verts = geometry.regularPolygonVertices(nSides, circumRadius);

    // Apply shape-specific rotations for better orientation
    if (nSides === 4) {
      // Rotate squares by 45 degrees to display as proper squares instead of diamonds
      verts = utils.rotateSquareVertices(verts);
    } else if (nSides === 6) {
      // Rotate regular hexagons by 90 degrees to have flat sides horizontal
      verts = utils.rotateHexagonVertices(verts);
    }

    curveScaleR = circumRadius;
  }

  return { verts, curveScaleR, edgeInclude };
}
