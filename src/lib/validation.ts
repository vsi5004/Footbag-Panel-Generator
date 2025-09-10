// Input validation and configuration management
// Centralizes all input validation logic and configuration collection

import type { UIConfig, GeometryConfig, PanelConfig, GeometryResult, Point } from '../types';
import { utils } from './utils';

// Window.FB is already declared in types.ts, so we don't need to redeclare it

type ValidatorFunction = (value: string | number, max?: number) => number;

export const INPUT_VALIDATORS: Record<string, ValidatorFunction> = {
  side: (value: string | number) => clamp(parseFloat(value.toString()), 10, 80),
  seam: (value: string | number) => clamp(parseFloat(value.toString()), 2, 9),
  hexLong: (value: string | number) => clamp(parseFloat(value.toString()), 10, 80),
  hexRatio: (value: string | number) => clamp(parseFloat(value.toString()), 0.1, 0.9),
  curveFactor: (value: string | number) => clamp(parseFloat(value.toString()), 0.10, 0.40),
  cornerMargin: (value: string | number, max: number = 100) => clamp(parseFloat(value.toString()), 0, Math.max(0, max)),
  holeSpacing: (value: string | number, max: number = 100) => clamp(parseFloat(value.toString()), 1, max),
  dotSize: (value: string | number) => clamp(parseFloat(value.toString()), 0.2, 1.5),
};

function clamp(value: number, min: number, max: number): number {
  return window.FB.utils.clamp(value, min, max);
}

/**
 * Collects and validates all input values from the UI
 */
export function collectInputValues(el: any): UIConfig {
  const { CURVATURE } = window.FB.CONSTANTS;
  const nSides = parseInt(el.shape?.value ?? '5', 10);
  const side = INPUT_VALIDATORS.side(el.side?.value ?? '30');
  const seam = INPUT_VALIDATORS.seam(el.seam?.value ?? '5');
  const stitches = parseInt(el.stitches?.value ?? '10', 10);
  const curvedEdges = el.curved?.checked ?? false;
  const hexType = el.hexType?.value ?? 'regular';
  const hexLong = el.hexLong ? INPUT_VALIDATORS.hexLong(el.hexLong.value) : 30;
  const hexRatio = el.hexRatio ? INPUT_VALIDATORS.hexRatio(el.hexRatio.value) : 0.5;
  const curveFactor = el.curveFactor ? 
    INPUT_VALIDATORS.curveFactor(el.curveFactor.value) : 
    (CURVATURE[nSides] || 0.3);
  const dotSize = INPUT_VALIDATORS.dotSize(el.dotSize?.value ?? '1');

  return {
    nSides,
    side,
    seam,
    stitches,
    curvedEdges,
    hexType,
    hexLong,
    hexRatio,
    curveFactor,
    dotSize,
  };
}

/**
 * Computes geometry parameters based on input configuration
 */
export function computeGeometry(config: GeometryConfig): GeometryResult {
  const { nSides, side, hexType, hexLong, hexRatio } = config;
  const { geometry } = window.FB;
  
  let verts: Point[];
  let curveScaleR: number;
  let edgeInclude: ((i: number) => boolean) | null = null;
  
  if (nSides === 6 && hexType === 'truncated') {
    const longSideLength = hexLong;
    const shortSideLength = INPUT_VALIDATORS.hexRatio(hexRatio) * longSideLength;
    verts = geometry.truncatedHexagonVertices(longSideLength, shortSideLength);
    let sumr = 0;
    for (const v of verts) sumr += Math.hypot(v.x, v.y);
    curveScaleR = (sumr / verts.length) || longSideLength;
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

/**
 * Updates dynamic UI constraints based on current geometry
 */
export function updateDynamicConstraints(config: UIConfig, geometry: GeometryResult, el: any): { cornerMargin: number; holeSpacing: number } {
  const { nSides, hexType, hexLong, side, stitches, curvedEdges, curveFactor } = config;
  const { verts, curveScaleR, edgeInclude } = geometry;
  const { SAMPLING } = window.FB.CONSTANTS;
  const { stitches: stitchHelpers } = window.FB;
  
  const cornerMax = (nSides === 6 && hexType === 'truncated') ? (hexLong / 4) : (side / 4);
  if (el.cornerMargin) {
    const cmMaxStr = String(Math.max(0, Math.round(cornerMax * 10) / 10));
    el.cornerMargin.max = cmMaxStr;
    el.cornerMarginNumber?.setAttribute('max', cmMaxStr);
  }
  
  const cornerMargin = el.cornerMargin ? 
    INPUT_VALIDATORS.cornerMargin(el.cornerMargin.value, cornerMax) : 2;
  
  const depth = curvedEdges ? curveScaleR * curveFactor : 0;
  const allowableSpacing = stitchHelpers.computeAllowableSpacing(
    verts, depth, stitches, cornerMargin, 
    SAMPLING.EDGE_SAMPLES_HIGH_PRECISION, edgeInclude
  );
  
  if (el.holeSpacing) {
    const maxStr = String(Math.max(1, Math.round(allowableSpacing * 10) / 10));
    el.holeSpacing.max = maxStr;
    el.holeSpacingNumber?.setAttribute('max', maxStr);
  }
  
  const holeSpacing = el.holeSpacing ? 
    INPUT_VALIDATORS.holeSpacing(el.holeSpacing.value, allowableSpacing) : 5;
  
  return { cornerMargin, holeSpacing };
}

/**
 * Creates a panel configuration from the UI config and constraints
 */
export function createPanelConfig(config: UIConfig, constraints: { cornerMargin: number; holeSpacing: number }): PanelConfig {
  return {
    nSides: config.nSides,
    sideLen: config.side,
    seamOffset: config.seam,
    stitchCount: config.stitches,
    curvedEdges: config.curvedEdges,
    hexType: config.hexType as 'regular' | 'truncated',
    hexLong: config.hexLong,
    hexRatio: config.hexRatio,
    curveFactor: config.curveFactor,
    holeSpacing: constraints.holeSpacing,
    cornerMargin: constraints.cornerMargin,
  };
}
