import type { DOMElements } from '../types';
import { utils } from './utils';
import { INPUT_VALIDATORS } from './validation';

const { clamp } = utils;

export interface SettingsData {
  $schema: string;
  version: number;
  shape: number;
  curved: boolean;
  curveRadius?: number;
  side: number;
  seam: number;
  stitches: number;
  showGrid?: boolean;
  cornerMargin?: number;
  holeSpacing?: number;
  dotSize: number;
  starRootOffset?: number;
  starRootAngle?: number;
  cornerStitchSpacing?: boolean;
  cornerStitchDistance?: number;
  hex: {
    type: string;
    long?: number;
    ratio?: number;
  };
  layout: {
    rows: number;
    cols: number;
    hSpace: number;
    vSpace: number;
    invert: boolean;
    nestingOffset: number;
    showGrid?: boolean;
  };
}

function collect(el: DOMElements, layoutEl?: any): SettingsData {
  return {
    $schema: './schema/settings.schema.json',
    version: 1,
    shape: INPUT_VALIDATORS.nSides(el.shape?.value || '5'),
    curved: !!el.curved?.checked,
    curveRadius: el.curved?.checked && el.curveRadius ? INPUT_VALIDATORS.curveRadius(el.curveRadius.value) : undefined,
    side: INPUT_VALIDATORS.side(el.side?.value || '30'),
    seam: INPUT_VALIDATORS.seam(el.seam?.value || '5'),
    stitches: INPUT_VALIDATORS.stitches(el.stitches?.value || '8'),
    showGrid: el.showGrid ? !!el.showGrid.checked : undefined,
    cornerMargin: el.cornerMargin ? clamp(parseFloat(el.cornerMargin.value), 0, 999) : undefined,
    holeSpacing: el.holeSpacing ? clamp(parseFloat(el.holeSpacing.value), 1, 999) : undefined,
    dotSize: INPUT_VALIDATORS.dotSize(el.dotSize?.value || '1'),
    starRootOffset: el.starRootOffset ? INPUT_VALIDATORS.starRootOffset(el.starRootOffset.value) : undefined,
    starRootAngle: el.starRootAngle ? INPUT_VALIDATORS.starRootAngle(el.starRootAngle.value) : undefined,
    cornerStitchSpacing: el.cornerStitchSpacing ? !!el.cornerStitchSpacing.checked : undefined,
    cornerStitchDistance: el.cornerStitchDistance ? INPUT_VALIDATORS.cornerStitchDistance(el.cornerStitchDistance.value) : undefined,
    hex: {
      type: el.hexType?.value || 'regular',
      long: el.hexLong ? clamp(parseFloat(el.hexLong.value), 10, 80) : undefined,
      ratio: el.hexRatio ? clamp(parseFloat(el.hexRatio.value), 0.1, 0.9) : undefined,
    },
    layout: {
      rows: parseInt(layoutEl?.pageRows?.value || '3', 10),
      cols: parseInt(layoutEl?.pageCols?.value || '3', 10),
      hSpace: parseFloat(layoutEl?.pageHSpaceNumber?.value || '0'),
      vSpace: parseFloat(layoutEl?.pageVSpace?.value || '1'),
      invert: !!(layoutEl?.pageInvert?.checked),
      nestingOffset: parseFloat(layoutEl?.nestingOffset?.value || '0'),
      showGrid: layoutEl?.pageEl?.showGrid ? !!layoutEl.pageEl.showGrid.checked : undefined,
    }
  };
}

function apply(el: DOMElements, s: Partial<SettingsData>, layoutEl?: any): void {
  if (!s || typeof s !== 'object') return;
  
  const set = (input: HTMLInputElement | null, value: any) => { 
    if (input != null && value != null && !Number.isNaN(value)) input.value = String(value); 
  };
  
  const setChecked = (input: HTMLInputElement | null, value: any) => { 
    if (input != null && typeof value === 'boolean') input.checked = value; 
  };

  // Panel settings
  if (typeof s.shape === 'number' && el.shape) el.shape.value = String(s.shape);
  setChecked(el.curved, !!s.curved);

  if (s.hex && typeof s.hex === 'object') {
    if (el.hexType && s.hex.type) el.hexType.value = s.hex.type;
    set(el.hexLong, s.hex.long ? clamp(parseFloat(String(s.hex.long)), 10, 80) : undefined);
    set(el.hexRatio, s.hex.ratio ? clamp(parseFloat(String(s.hex.ratio)), 0.1, 0.9) : undefined);
    if (el.hexLongNumber && el.hexLong) el.hexLongNumber.textContent = el.hexLong.value;
    if (el.hexRatioNumber && el.hexRatio) el.hexRatioNumber.textContent = el.hexRatio.value;
  }

  set(el.side, s.side ? clamp(parseFloat(String(s.side)), 10, 80) : undefined);
  if (el.sideNumber && el.side) el.sideNumber.textContent = el.side.value;
  
  set(el.seam, s.seam ? clamp(parseFloat(String(s.seam)), 2, 9) : undefined);
  if (el.seamNumber && el.seam) el.seamNumber.textContent = el.seam.value;

  if (el.curved?.checked && s.curveRadius != null) {
    set(el.curveRadius, clamp(parseFloat(String(s.curveRadius)), 10, 130));
    if (el.curveRadiusNumber && el.curveRadius) el.curveRadiusNumber.textContent = el.curveRadius.value;
  }

  if (s.stitches != null) set(el.stitches, clamp(parseInt(String(s.stitches), 10), 1, 50));
  if (el.stitchesNumber && el.stitches) el.stitchesNumber.textContent = el.stitches.value;
  
  if (s.showGrid != null && el.showGrid) { el.showGrid.checked = !!s.showGrid; }
  
  if (s.cornerMargin != null && el.cornerMargin) { 
    set(el.cornerMargin, Math.max(0, parseFloat(String(s.cornerMargin)))); 
    if (el.cornerMarginNumber) el.cornerMarginNumber.textContent = el.cornerMargin.value;
  }
  
  if (s.holeSpacing != null && el.holeSpacing) { 
    set(el.holeSpacing, Math.max(1, parseFloat(String(s.holeSpacing)))); 
    if (el.holeSpacingNumber) el.holeSpacingNumber.textContent = el.holeSpacing.value;
  }
  
  if (s.cornerStitchSpacing != null && el.cornerStitchSpacing) {
    el.cornerStitchSpacing.checked = !!s.cornerStitchSpacing;
  }
  
  if (s.cornerStitchDistance != null && el.cornerStitchDistance) {
    set(el.cornerStitchDistance, INPUT_VALIDATORS.cornerStitchDistance(s.cornerStitchDistance));
    if (el.cornerStitchDistanceNumber) el.cornerStitchDistanceNumber.textContent = el.cornerStitchDistance.value;
  }
  
  if (s.dotSize != null) { 
    set(el.dotSize, clamp(parseFloat(String(s.dotSize)), 0.2, 1.5)); 
    if (el.dotSizeNumber && el.dotSize) el.dotSizeNumber.textContent = el.dotSize.value;
  }

  if (s.starRootOffset != null && el.starRootOffset) {
    set(el.starRootOffset, INPUT_VALIDATORS.starRootOffset(s.starRootOffset));
    if (el.starRootOffsetNumber) el.starRootOffsetNumber.textContent = el.starRootOffset.value;
  }

  if (s.starRootAngle != null && el.starRootAngle) {
    set(el.starRootAngle, INPUT_VALIDATORS.starRootAngle(s.starRootAngle));
    if (el.starRootAngleNumber) el.starRootAngleNumber.textContent = el.starRootAngle.value;
  }

  // Layout settings
  if (s.layout && typeof s.layout === 'object' && layoutEl) {
    if (s.layout.rows != null) {
      set(layoutEl.pageRows, clamp(parseInt(String(s.layout.rows), 10), 1, 10));
      set(layoutEl.pageRowsNumber, layoutEl.pageRows?.value);
    }
    if (s.layout.cols != null) {
      set(layoutEl.pageCols, clamp(parseInt(String(s.layout.cols), 10), 1, 10));
      set(layoutEl.pageColsNumber, layoutEl.pageCols?.value);
    }
    if (s.layout.hSpace != null) {
      set(layoutEl.pageHSpace, clamp(parseFloat(String(s.layout.hSpace)), -20, 50));
      set(layoutEl.pageHSpaceNumber, layoutEl.pageHSpace?.value);
    }
    if (s.layout.vSpace != null) {
      set(layoutEl.pageVSpace, clamp(parseFloat(String(s.layout.vSpace)), 0, 50));
      set(layoutEl.pageVSpaceNumber, layoutEl.pageVSpace?.value);
    }
    if (s.layout.invert != null) {
      setChecked(layoutEl.pageInvert, s.layout.invert);
    }
    if (s.layout.nestingOffset != null) {
      set(layoutEl.nestingOffset, clamp(parseFloat(String(s.layout.nestingOffset)), -40, 40));
      set(layoutEl.nestingOffsetNumber, layoutEl.nestingOffset?.value);
    }
    if (s.layout.showGrid != null && layoutEl.pageEl?.showGrid) {
      layoutEl.pageEl.showGrid.checked = !!s.layout.showGrid;
    }
  }
}

export const state = { collect, apply };

// For backward compatibility with global window.FB
window.FB = window.FB || {};
window.FB.state = state;
