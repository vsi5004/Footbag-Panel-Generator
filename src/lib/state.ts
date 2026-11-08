import type { PanelElements, LayoutSettingsElements } from '../types';
import { utils } from './utils';
import { INPUT_VALIDATORS } from './validation';
import { normalizeExportScale } from './export';
import { normalizeSetting } from './settings';
import { panelControlPairs } from './controls';
import { syncPairDisplay } from './ui';

const { clamp } = utils;

export interface SettingsData {
  $schema: string;
  version: number;
  shape: number;
  curved: boolean;
  curveRadius?: number;
  side: number;
  seam: number;
  showHoles?: boolean;
  stitches: number;
  showGrid?: boolean;
  cornerMargin?: number;
  holeSpacing?: number;
  holeBunching?: number;
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
  export?: { scalePercent?: number };
  layout: {
    padding: number;
    rows: number;
    cols: number;
    hSpace: number;
    vSpace: number;
    invert: boolean;
    nestingOffset: number;
    showGrid?: boolean;
  };
}

function collect(el: PanelElements, layoutEl?: LayoutSettingsElements): SettingsData {
  return {
    $schema: './schema/settings.schema.json',
    version: 1,
    shape: INPUT_VALIDATORS.nSides(el.shape?.value || '5'),
    curved: !!el.curved?.checked,
    curveRadius:
      el.curved?.checked && el.curveRadius
        ? INPUT_VALIDATORS.curveRadius(el.curveRadius.value)
        : undefined,
    side: INPUT_VALIDATORS.side(el.side?.value || '30'),
    seam: INPUT_VALIDATORS.seam(el.seam?.value || '5'),
    showHoles: el.showHoles ? !!el.showHoles.checked : undefined,
    stitches: INPUT_VALIDATORS.stitches(el.stitches?.value || '8'),
    showGrid: el.showGrid ? !!el.showGrid.checked : undefined,
    cornerMargin: el.cornerMargin ? clamp(parseFloat(el.cornerMargin.value), 0, 999) : undefined,
    holeSpacing: el.holeSpacing ? clamp(parseFloat(el.holeSpacing.value), 1, 999) : undefined,
    holeBunching: el.holeBunching ? clamp(parseFloat(el.holeBunching.value), 0, 999) : undefined,
    dotSize: INPUT_VALIDATORS.dotSize(el.dotSize?.value || '1'),
    starRootOffset: el.starRootOffset
      ? INPUT_VALIDATORS.starRootOffset(el.starRootOffset.value)
      : undefined,
    starRootAngle: el.starRootAngle
      ? INPUT_VALIDATORS.starRootAngle(el.starRootAngle.value)
      : undefined,
    cornerStitchSpacing: el.cornerStitchSpacing ? !!el.cornerStitchSpacing.checked : undefined,
    cornerStitchDistance: el.cornerStitchDistance
      ? INPUT_VALIDATORS.cornerStitchDistance(el.cornerStitchDistance.value)
      : undefined,
    hex: {
      type: el.hexType?.value || 'regular',
      long: el.hexLong ? normalizeSetting('hexLong', el.hexLong.value) : undefined,
      ratio: el.hexRatio ? normalizeSetting('hexRatio', el.hexRatio.value) : undefined,
    },
    export: { scalePercent: normalizeExportScale(el.exportScale?.value) },
    layout: {
      padding: parseFloat(layoutEl?.pagePadding?.value || '10'),
      rows: parseInt(layoutEl?.pageRows?.value || '3', 10),
      cols: parseInt(layoutEl?.pageCols?.value || '3', 10),
      hSpace: parseFloat(layoutEl?.pageHSpaceNumber?.value || '0'),
      vSpace: parseFloat(layoutEl?.pageVSpace?.value || '1'),
      invert: !!layoutEl?.pageInvert?.checked,
      nestingOffset: parseFloat(layoutEl?.nestingOffset?.value || '0'),
      showGrid: layoutEl?.pageEl?.showGrid ? !!layoutEl.pageEl.showGrid.checked : undefined,
    },
  };
}

function apply(
  el: PanelElements,
  s: Partial<SettingsData>,
  layoutEl?: LayoutSettingsElements,
): void {
  if (!s || typeof s !== 'object') return;

  const set = (input: HTMLInputElement | null, value: unknown) => {
    if (input != null && value != null && !Number.isNaN(value)) input.value = String(value);
  };

  const setChecked = (input: HTMLInputElement | null, value: unknown) => {
    if (input != null && typeof value === 'boolean') input.checked = value;
  };

  // Missing export settings in older files must reset a previously selected scale.
  set(el.exportScale, normalizeExportScale(s.export?.scalePercent));

  // Panel settings
  if (typeof s.shape === 'number' && el.shape) el.shape.value = String(s.shape);
  setChecked(el.curved, !!s.curved);

  if (s.hex && typeof s.hex === 'object') {
    if (el.hexType && s.hex.type) el.hexType.value = s.hex.type;
    set(el.hexLong, s.hex.long ? normalizeSetting('hexLong', s.hex.long) : undefined);
    set(el.hexRatio, s.hex.ratio ? normalizeSetting('hexRatio', s.hex.ratio) : undefined);
  }

  set(el.side, s.side ? normalizeSetting('side', s.side) : undefined);

  set(el.seam, s.seam != null ? normalizeSetting('seam', s.seam) : undefined);

  if (el.curved?.checked && s.curveRadius != null) {
    set(el.curveRadius, normalizeSetting('curveRadius', s.curveRadius));
  }

  if (s.showHoles != null && el.showHoles) {
    el.showHoles.checked = !!s.showHoles;
  }

  if (s.stitches != null) set(el.stitches, clamp(parseInt(String(s.stitches), 10), 1, 50));

  if (s.showGrid != null && el.showGrid) {
    el.showGrid.checked = !!s.showGrid;
  }

  if (s.cornerMargin != null && el.cornerMargin) {
    set(el.cornerMargin, Math.max(0, parseFloat(String(s.cornerMargin))));
  }

  if (s.holeSpacing != null && el.holeSpacing) {
    set(el.holeSpacing, Math.max(1, parseFloat(String(s.holeSpacing))));
  }

  if (s.holeBunching != null && el.holeBunching) {
    set(el.holeBunching, Math.max(0, parseFloat(String(s.holeBunching))));
  }

  if (s.cornerStitchSpacing != null && el.cornerStitchSpacing) {
    el.cornerStitchSpacing.checked = !!s.cornerStitchSpacing;
  }

  if (s.cornerStitchDistance != null && el.cornerStitchDistance) {
    set(el.cornerStitchDistance, INPUT_VALIDATORS.cornerStitchDistance(s.cornerStitchDistance));
  }

  if (s.dotSize != null) {
    set(el.dotSize, normalizeSetting('dotSize', s.dotSize));
  }

  if (s.starRootOffset != null && el.starRootOffset) {
    set(el.starRootOffset, INPUT_VALIDATORS.starRootOffset(s.starRootOffset));
  }

  if (s.starRootAngle != null && el.starRootAngle) {
    set(el.starRootAngle, INPUT_VALIDATORS.starRootAngle(s.starRootAngle));
  }

  for (const [range, display] of panelControlPairs(el)) syncPairDisplay(range, display);

  // Layout settings
  if (s.layout && typeof s.layout === 'object' && layoutEl) {
    if (s.layout.padding != null) {
      set(layoutEl.pagePadding, normalizeSetting('pagePadding', s.layout.padding));
      set(layoutEl.pagePaddingNumber, layoutEl.pagePadding?.value);
    }
    if (s.layout.rows != null) {
      set(layoutEl.pageRows, normalizeSetting('pageRows', s.layout.rows));
      set(layoutEl.pageRowsNumber, layoutEl.pageRows?.value);
    }
    if (s.layout.cols != null) {
      set(layoutEl.pageCols, normalizeSetting('pageCols', s.layout.cols));
      set(layoutEl.pageColsNumber, layoutEl.pageCols?.value);
    }
    if (s.layout.hSpace != null) {
      set(layoutEl.pageHSpace, normalizeSetting('pageHSpace', s.layout.hSpace));
      set(layoutEl.pageHSpaceNumber, layoutEl.pageHSpace?.value);
    }
    if (s.layout.vSpace != null) {
      set(layoutEl.pageVSpace, normalizeSetting('pageVSpace', s.layout.vSpace));
      set(layoutEl.pageVSpaceNumber, layoutEl.pageVSpace?.value);
    }
    if (s.layout.invert != null) {
      setChecked(layoutEl.pageInvert, s.layout.invert);
    }
    if (s.layout.nestingOffset != null) {
      set(layoutEl.nestingOffset, normalizeSetting('nestingOffset', s.layout.nestingOffset));
      set(layoutEl.nestingOffsetNumber, layoutEl.nestingOffset?.value);
    }
    if (s.layout.showGrid != null && layoutEl.pageEl?.showGrid) {
      layoutEl.pageEl.showGrid.checked = !!s.layout.showGrid;
    }
  }
}

export const state = { collect, apply };
