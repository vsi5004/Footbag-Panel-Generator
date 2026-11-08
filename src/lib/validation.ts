// Input validation and configuration management
// Centralizes all input validation logic and configuration collection

import type {
  UIConfig,
  GeometryConfig,
  PanelConfig,
  GeometryResult,
  PanelElements,
} from '../types';
import { utils } from './utils';
import { createPolygonGeometry } from './shape-geometry';
import { stitches as stitchHelpers } from './stitches';
import { CONSTANTS } from './constants';
import { normalizeSetting } from './settings';

type ValidatorFunction = (value: string | number, max?: number) => number;

export const INPUT_VALIDATORS: Record<string, ValidatorFunction> = {
  nSides: (value: string | number) => clamp(parseInt(value.toString(), 10), 3, 10),
  side: (value: string | number) => normalizeSetting('side', value),
  seam: (value: string | number) => normalizeSetting('seam', value),
  stitches: (value: string | number) => normalizeSetting('stitches', value),
  hexLong: (value: string | number) => normalizeSetting('hexLong', value),
  hexRatio: (value: string | number) => normalizeSetting('hexRatio', value),
  curveRadius: (value: string | number) => normalizeSetting('curveRadius', value),
  cornerMargin: (value: string | number, max: number = 100) =>
    normalizeSetting('cornerMargin', value, Math.max(0, max)),
  holeSpacing: (value: string | number, max: number = 100) =>
    normalizeSetting('holeSpacing', value, max),
  holeBunching: (value: string | number, max: number = 100) =>
    normalizeSetting('holeBunching', value, max),
  dotSize: (value: string | number) => normalizeSetting('dotSize', value),
  starRootOffset: (value: string | number) => normalizeSetting('starRootOffset', value),
  starRootAngle: (value: string | number) => normalizeSetting('starRootAngle', value),
  cornerStitchDistance: (value: string | number) => normalizeSetting('cornerStitchDistance', value),
};

function clamp(value: number, min: number, max: number): number {
  return utils.clamp(value, min, max);
}

/**
 * Collects and validates all input values from the UI
 */
export function collectInputValues(el: PanelElements): UIConfig {
  const nSides = INPUT_VALIDATORS.nSides(el.shape?.value ?? '5');
  const side = INPUT_VALIDATORS.side(el.side?.value ?? '30');
  const seam = INPUT_VALIDATORS.seam(el.seam?.value ?? '5');
  const showHoles = el.showHoles?.checked ?? true;
  const stitches = showHoles ? INPUT_VALIDATORS.stitches(el.stitches?.value ?? '10') : 0;
  const curvedEdges = el.curved?.checked ?? false;
  const hexType = el.hexType?.value ?? 'regular';
  const hexLong = el.hexLong ? INPUT_VALIDATORS.hexLong(el.hexLong.value) : 30;
  const hexRatio = el.hexRatio ? INPUT_VALIDATORS.hexRatio(el.hexRatio.value) : 0.5;
  const curveRadius = el.curveRadius ? INPUT_VALIDATORS.curveRadius(el.curveRadius.value) : 60;
  const dotSize = INPUT_VALIDATORS.dotSize(el.dotSize?.value ?? '1');
  const holeBunching = el.holeBunching
    ? INPUT_VALIDATORS.holeBunching(el.holeBunching.value, 10)
    : 0;
  const starRootOffset = el.starRootOffset
    ? INPUT_VALIDATORS.starRootOffset(el.starRootOffset.value)
    : -1.5;
  const starRootAngle = el.starRootAngle
    ? INPUT_VALIDATORS.starRootAngle(el.starRootAngle.value)
    : 128;
  const cornerStitchSpacing = el.cornerStitchSpacing?.checked ?? false;
  const cornerStitchDistance = el.cornerStitchDistance
    ? INPUT_VALIDATORS.cornerStitchDistance(el.cornerStitchDistance.value)
    : 3;

  return {
    nSides,
    side,
    seam,
    stitches,
    curvedEdges,
    hexType,
    hexLong,
    hexRatio,
    curveRadius,
    dotSize,
    holeBunching,
    starRootOffset,
    starRootAngle,
    cornerStitchSpacing,
    cornerStitchDistance,
  };
}

/**
 * Computes geometry parameters based on input configuration
 */
export function computeGeometry(config: GeometryConfig): GeometryResult {
  // Keep the deployed star constraint approximation separate from rendered star vertices.
  // Changing that approximation would change existing stitch-spacing limits.
  return createPolygonGeometry({ ...config, hexRatio: INPUT_VALIDATORS.hexRatio(config.hexRatio) });
}

/**
 * Updates dynamic UI constraints based on current geometry
 */
export function updateDynamicConstraints(
  config: UIConfig,
  geometry: GeometryResult,
  el: PanelElements,
): { cornerMargin: number; holeSpacing: number; holeBunching: number } {
  const { nSides, hexType, hexLong, side, stitches, curvedEdges, curveRadius, starRootOffset } =
    config;
  const { verts, edgeInclude } = geometry;
  const { SAMPLING } = CONSTANTS;

  const cornerMax = nSides === 6 && hexType === 'truncated' ? hexLong / 4 : side / 4;
  if (el.cornerMargin) {
    const cmMaxStr = String(Math.max(0, Math.round(cornerMax * 10) / 10));
    el.cornerMargin.max = cmMaxStr;
    el.cornerMarginNumber?.setAttribute('max', cmMaxStr);
  }

  const cornerMargin = el.cornerMargin
    ? INPUT_VALIDATORS.cornerMargin(el.cornerMargin.value, cornerMax)
    : 2;

  // Ensure curveRadius is feasible for all chords: R >= max(chord)/2
  if (el.curveRadius) {
    let maxChord = 0;
    for (let i = 0; i < verts.length; i++) {
      const a = verts[i];
      const b = verts[(i + 1) % verts.length];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d > maxChord) maxChord = d;
    }
    const minR = Math.max(10, maxChord / 2);
    el.curveRadius.min = String(Math.round(minR * 10) / 10);
    el.curveRadiusNumber?.setAttribute('min', String(Math.round(minR * 10) / 10));
    // If current radius is too small, clamp display inputs (value will be re-read next render)
    const current = parseFloat(el.curveRadius.value || '60');
    if (current < minR) {
      el.curveRadius.value = String(minR);
      if (el.curveRadiusNumber) el.curveRadiusNumber.value = String(minR);
    }
  }

  const radius = curvedEdges ? curveRadius : 0;
  const allowableSpacing = stitchHelpers.computeAllowableSpacing(
    verts,
    radius,
    stitches,
    cornerMargin,
    SAMPLING.EDGE_SAMPLES_HIGH_PRECISION,
    edgeInclude,
    starRootOffset,
  );

  if (el.holeSpacing) {
    const maxStr = String(Math.max(1, Math.round(allowableSpacing * 10) / 10));
    el.holeSpacing.max = maxStr;
    el.holeSpacingNumber?.setAttribute('max', maxStr);
  }

  const holeSpacing = el.holeSpacing
    ? INPUT_VALIDATORS.holeSpacing(el.holeSpacing.value, allowableSpacing)
    : 3;

  // Update holeBunching max to be half of holeSpacing
  const bunchingMax = holeSpacing / 2;
  if (el.holeBunching) {
    const maxStr = String(Math.max(0, Math.round(bunchingMax * 10) / 10));
    el.holeBunching.max = maxStr;
    el.holeBunchingNumber?.setAttribute('max', maxStr);
  }

  const holeBunching = el.holeBunching
    ? INPUT_VALIDATORS.holeBunching(el.holeBunching.value, bunchingMax)
    : 0;

  return { cornerMargin, holeSpacing, holeBunching };
}

/**
 * Creates a panel configuration from the UI config and constraints
 */
export function createPanelConfig(
  config: UIConfig,
  constraints: { cornerMargin: number; holeSpacing: number; holeBunching: number },
): PanelConfig {
  return {
    nSides: config.nSides,
    sideLen: config.side,
    seamOffset: config.seam,
    stitchCount: config.stitches,
    curvedEdges: config.curvedEdges,
    hexType: config.hexType as 'regular' | 'truncated',
    hexLong: config.hexLong,
    hexRatio: config.hexRatio,
    curveRadius: config.curveRadius,
    holeSpacing: constraints.holeSpacing,
    holeBunching: constraints.holeBunching,
    cornerMargin: constraints.cornerMargin,
    starRootOffset: config.starRootOffset,
    starRootAngle: config.starRootAngle,
    cornerStitchSpacing: config.cornerStitchSpacing,
    cornerStitchDistance: config.cornerStitchDistance,
  };
}
