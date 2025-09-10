import type { DOMElements } from '../types';
import { utils } from './utils';

const { clamp } = utils;

interface SettingsData {
  $schema: string;
  version: number;
  shape: number;
  curved: boolean;
  curveFactor?: number;
  side: number;
  seam: number;
  stitches: number;
  showGrid?: boolean;
  cornerMargin?: number;
  holeSpacing?: number;
  dotSize: number;
  hex: {
    type: string;
    long?: number;
    ratio?: number;
  };
}

function collect(el: DOMElements): SettingsData {
  return {
    $schema: './schema/settings.schema.json',
    version: 1,
    shape: parseInt(el.shape?.value || '5', 10),
    curved: !!el.curved?.checked,
    curveFactor: el.curved?.checked && el.curveFactor ? clamp(parseFloat(el.curveFactor.value), 0.10, 0.40) : undefined,
    side: clamp(parseFloat(el.side?.value || '30'), 10, 80),
    seam: clamp(parseFloat(el.seam?.value || '5'), 2, 9),
    stitches: parseInt(el.stitches?.value || '10', 10),
    showGrid: el.showGrid ? !!el.showGrid.checked : undefined,
    cornerMargin: el.cornerMargin ? clamp(parseFloat(el.cornerMargin.value), 0, 999) : undefined,
    holeSpacing: el.holeSpacing ? clamp(parseFloat(el.holeSpacing.value), 1, 999) : undefined,
    dotSize: clamp(parseFloat(el.dotSize?.value || '1'), 0.2, 1.5),
    hex: {
      type: el.hexType?.value || 'regular',
      long: el.hexLong ? clamp(parseFloat(el.hexLong.value), 10, 80) : undefined,
      ratio: el.hexRatio ? clamp(parseFloat(el.hexRatio.value), 0.1, 0.9) : undefined,
    }
  };
}

function apply(el: DOMElements, s: Partial<SettingsData>): void {
  if (!s || typeof s !== 'object') return;
  
  const set = (input: HTMLInputElement | null, value: any) => { 
    if (input != null && value != null && !Number.isNaN(value)) input.value = String(value); 
  };
  
  const setChecked = (input: HTMLInputElement | null, value: any) => { 
    if (input != null && typeof value === 'boolean') input.checked = value; 
  };

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

  if (el.curved?.checked && s.curveFactor != null) {
    set(el.curveFactor, clamp(parseFloat(String(s.curveFactor)), 0.10, 0.40));
    if (el.curveFactorNumber && el.curveFactor) el.curveFactorNumber.textContent = el.curveFactor.value;
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
  
  if (s.dotSize != null) { 
    set(el.dotSize, clamp(parseFloat(String(s.dotSize)), 0.2, 1.5)); 
    if (el.dotSizeNumber && el.dotSize) el.dotSizeNumber.textContent = el.dotSize.value;
  }
}

export const state = { collect, apply };

// For backward compatibility with global window.FB
window.FB = window.FB || {};
window.FB.state = state;
