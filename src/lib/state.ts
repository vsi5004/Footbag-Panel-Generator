import { applyEditableLayout } from './editable-layout';
import type { EditableLayout } from './lattice';
import type { PanelElements, LayoutSettingsElements } from '../types';
import { utils } from './utils';
import {
  INPUT_VALIDATORS,
  collectInputValues,
  computeGeometry,
  updateDynamicConstraints,
} from './validation';
import { normalizeExportScale, syncExportScaleControls } from './export';
import { normalizeSetting } from './settings';
import { readImportedSettings } from './import-settings';
import { panelControlPairs } from './controls';
import { collectNestingPreferences, applyNestingPreferences } from './nesting-preferences';
import type { NestingPreferences } from './nesting-types';
import type { NestingPlan } from './nesting-types';
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
    editable?: EditableLayout;
    optimized?: NestingPlan;
    nesting?: NestingPreferences;
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
  const nesting = collectNestingPreferences(layoutEl);
  const optimized = layoutEl?.nesting?.active;
  // Older readers must reject advanced layouts instead of silently using a grid.
  const advanced = !!(
    layoutEl?.editable?.current ||
    nesting ||
    optimized?.stock ||
    optimized?.rotations ||
    optimized?.lattice
  );
  return {
    $schema: './schema/settings.schema.json',
    version: advanced ? 2 : 1,
    shape: INPUT_VALIDATORS.nSides(el.shape?.value || '5'),
    curved: !!el.curved?.checked,
    curveRadius: el.curveRadius ? INPUT_VALIDATORS.curveRadius(el.curveRadius.value) : undefined,
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
      ...(layoutEl?.editable?.current ? { editable: layoutEl.editable.current } : {}),
      ...(!layoutEl?.editable?.current && layoutEl?.nesting?.active
        ? { optimized: layoutEl.nesting.active }
        : {}),
      ...(nesting ? { nesting } : {}),
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

function apply(el: PanelElements, data: unknown, layoutEl?: LayoutSettingsElements): void {
  const s = readImportedSettings(data);
  if (layoutEl) applyEditableLayout(layoutEl, s.layout?.editable);
  // Older files always restore the manual layout, never a previous optimization.
  if (layoutEl?.nesting) {
    layoutEl.nesting.active = s.layout?.optimized;
    layoutEl.nesting.constraintsEdited = false;
  }

  if (layoutEl)
    applyNestingPreferences(layoutEl, s.layout?.nesting, s.layout?.optimized, s.layout?.editable);

  const set = (input: HTMLInputElement | null, value: unknown) => {
    if (input == null || typeof value !== 'number' || !Number.isFinite(value)) return;
    // Browser range inputs clamp immediately. Release bounds inherited from the
    // previous design; rendering recomputes the bounds for the imported design.
    if (['curveRadius', 'cornerMargin', 'holeSpacing', 'holeBunching'].includes(input.id)) {
      if (input.min !== '' && Number(input.min) > value) input.min = String(value);
      if (input.max !== '' && Number(input.max) < value) input.max = String(value);
    }
    input.value = String(value);
  };

  const setChecked = (input: HTMLInputElement | null, value: unknown) => {
    if (input != null && typeof value === 'boolean') input.checked = value;
  };

  // Missing export settings in older files must reset a previously selected scale.
  set(el.exportScale, normalizeExportScale(s.export?.scalePercent));
  syncExportScaleControls(normalizeExportScale(s.export?.scalePercent));

  // Panel settings
  if (typeof s.shape === 'number' && el.shape) el.shape.value = String(s.shape);
  setChecked(el.curved, s.curved);

  if (s.hex && typeof s.hex === 'object') {
    if (el.hexType && s.hex.type) el.hexType.value = s.hex.type;
    set(el.hexLong, s.hex.long != null ? normalizeSetting('hexLong', s.hex.long) : undefined);
    set(el.hexRatio, s.hex.ratio != null ? normalizeSetting('hexRatio', s.hex.ratio) : undefined);
  }

  set(el.side, s.side != null ? normalizeSetting('side', s.side) : undefined);

  set(el.seam, s.seam != null ? normalizeSetting('seam', s.seam) : undefined);

  if (s.curveRadius != null) {
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
    set(el.cornerMargin, normalizeSetting('cornerMargin', s.cornerMargin, Infinity));
  }

  if (s.holeSpacing != null && el.holeSpacing) {
    set(el.holeSpacing, normalizeSetting('holeSpacing', s.holeSpacing, Infinity));
  }

  if (s.holeBunching != null && el.holeBunching) {
    set(el.holeBunching, normalizeSetting('holeBunching', s.holeBunching, Infinity));
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

  // Establish the imported design's limits before the first render reads its
  // configuration, including a feasible curve radius and stitch spacing.
  const config = collectInputValues(el);
  updateDynamicConstraints(config, computeGeometry(config), el);
  for (const [range, display] of panelControlPairs(el)) {
    if (range) {
      // Explicitly enforce refreshed bounds before copying the displayed value.
      range.value = String(clamp(Number(range.value), Number(range.min), Number(range.max)));
    }
    syncPairDisplay(range, display);
  }

  // Layout settings
  if (s.layout && typeof s.layout === 'object' && layoutEl) {
    if (s.layout.padding != null) {
      set(layoutEl.pagePadding, normalizeSetting('pagePadding', s.layout.padding));
      if (layoutEl.pagePadding && layoutEl.pagePaddingNumber)
        layoutEl.pagePaddingNumber.value = layoutEl.pagePadding.value;
    }
    if (s.layout.rows != null) {
      set(layoutEl.pageRows, normalizeSetting('pageRows', s.layout.rows));
      if (layoutEl.pageRows && layoutEl.pageRowsNumber)
        layoutEl.pageRowsNumber.value = layoutEl.pageRows.value;
    }
    if (s.layout.cols != null) {
      set(layoutEl.pageCols, normalizeSetting('pageCols', s.layout.cols));
      if (layoutEl.pageCols && layoutEl.pageColsNumber)
        layoutEl.pageColsNumber.value = layoutEl.pageCols.value;
    }
    if (s.layout.hSpace != null) {
      set(layoutEl.pageHSpace, normalizeSetting('pageHSpace', s.layout.hSpace));
      if (layoutEl.pageHSpace && layoutEl.pageHSpaceNumber)
        layoutEl.pageHSpaceNumber.value = layoutEl.pageHSpace.value;
    }
    if (s.layout.vSpace != null) {
      set(layoutEl.pageVSpace, normalizeSetting('pageVSpace', s.layout.vSpace));
      if (layoutEl.pageVSpace && layoutEl.pageVSpaceNumber)
        layoutEl.pageVSpaceNumber.value = layoutEl.pageVSpace.value;
    }
    if (s.layout.invert != null) {
      setChecked(layoutEl.pageInvert, s.layout.invert);
    }
    if (s.layout.nestingOffset != null) {
      set(layoutEl.nestingOffset, normalizeSetting('nestingOffset', s.layout.nestingOffset));
      if (layoutEl.nestingOffset && layoutEl.nestingOffsetNumber)
        layoutEl.nestingOffsetNumber.value = layoutEl.nestingOffset.value;
    }
    if (s.layout.showGrid != null && layoutEl.pageEl?.showGrid) {
      layoutEl.pageEl.showGrid.checked = !!s.layout.showGrid;
    }
  }
  document.dispatchEvent(new window.Event('layout-settings-applied'));
}

export const state = { collect, apply };
