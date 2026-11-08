// Centralizes DOM element selection and setup

import type { PanelElements, PageElements, LayoutElements } from '../types';

/**
 * Selects the controls and preview owned by the panel designer
 */
export function createMainElements(): PanelElements {
  return {
    shape: document.getElementById('shape') as HTMLSelectElement,
    side: document.getElementById('side') as HTMLInputElement,
    showHoles: document.getElementById('showHoles') as HTMLInputElement,
    stitchesRow: document.getElementById('stitchesRow') as HTMLElement,
    seamRow: document.getElementById('seamRow') as HTMLElement,
    seam: document.getElementById('seam') as HTMLInputElement,
    curved: document.getElementById('curved') as HTMLInputElement,
    stitches: document.getElementById('stitches') as HTMLInputElement,
    dotSize: document.getElementById('dotSize') as HTMLInputElement,
    svgHost: document.getElementById('svgHost'),
    downloadSvg: document.getElementById('downloadSvg') as HTMLButtonElement,

    sideNumber: document.getElementById('sideNumber') as HTMLInputElement,
    sideRow: document.getElementById('sideRow'),
    seamNumber: document.getElementById('seamNumber') as HTMLInputElement,
    curveRadiusRow: document.getElementById('curveRadiusRow'),
    curveRadius: document.getElementById('curveRadius') as HTMLInputElement,
    curveRadiusNumber: document.getElementById('curveRadiusNumber') as HTMLInputElement,
    stitchesNumber: document.getElementById('stitchesNumber') as HTMLInputElement,
    cornerMargin: document.getElementById('cornerMargin') as HTMLInputElement,
    cornerMarginNumber: document.getElementById('cornerMarginNumber') as HTMLInputElement,
    starRootOffsetRow: document.getElementById('starRootOffsetRow') as HTMLElement,
    starRootOffset: document.getElementById('starRootOffset') as HTMLInputElement,
    starRootOffsetNumber: document.getElementById('starRootOffsetNumber') as HTMLInputElement,
    starRootAngleRow: document.getElementById('starRootAngleRow') as HTMLElement,
    starRootAngle: document.getElementById('starRootAngle') as HTMLInputElement,
    starRootAngleNumber: document.getElementById('starRootAngleNumber') as HTMLInputElement,
    holeSpacing: document.getElementById('holeSpacing') as HTMLInputElement,
    holeSpacingNumber: document.getElementById('holeSpacingNumber') as HTMLInputElement,
    holeBunching: document.getElementById('holeBunching') as HTMLInputElement,
    holeBunchingNumber: document.getElementById('holeBunchingNumber') as HTMLInputElement,
    cornerStitchSpacing: document.getElementById('cornerStitchSpacing') as HTMLInputElement,
    cornerStitchSpacingRow: document.getElementById('cornerStitchSpacingRow') as HTMLElement,
    cornerStitchDistance: document.getElementById('cornerStitchDistance') as HTMLInputElement,
    cornerStitchDistanceNumber: document.getElementById(
      'cornerStitchDistanceNumber',
    ) as HTMLInputElement,
    dotSizeNumber: document.getElementById('dotSizeNumber') as HTMLInputElement,

    hexTypeRow: document.getElementById('hexTypeRow'),
    hexLongRow: document.getElementById('hexLongRow'),
    hexRatioRow: document.getElementById('hexRatioRow'),
    hexType: document.getElementById('hexType') as HTMLSelectElement,
    hexLong: document.getElementById('hexLong') as HTMLInputElement,
    hexLongNumber: document.getElementById('hexLongNumber') as HTMLInputElement,
    hexRatio: document.getElementById('hexRatio') as HTMLInputElement,
    hexRatioNumber: document.getElementById('hexRatioNumber') as HTMLInputElement,

    exportScale: document.getElementById('exportScale') as HTMLInputElement,
    exportSettings: document.getElementById('exportSettings') as HTMLButtonElement,
    importSettings: document.getElementById('importSettings') as HTMLButtonElement,
    importFile: document.getElementById('importFile') as HTMLInputElement,

    zoom: document.getElementById('zoom') as HTMLInputElement,
    zoomIn: document.getElementById('zoomIn') as HTMLButtonElement,
    zoomOut: document.getElementById('zoomOut') as HTMLButtonElement,
    zoomReset: document.getElementById('zoomReset') as HTMLButtonElement,
    zoomLabel: document.getElementById('zoomLabel') as HTMLSpanElement,
    showGrid: document.getElementById('showGrid') as HTMLInputElement,
    resetPanelSettings: document.getElementById('resetPanelSettings') as HTMLButtonElement,
    // Panel info elements
    panelInfoContainer: document.getElementById('panelInfoContainer') as HTMLElement,
    panelSideLength: document.getElementById('panelSideLength') as HTMLElement,
    panelSideLengthValue: document.getElementById('panelSideLengthValue') as HTMLSpanElement,
    panelStitchedLength: document.getElementById('panelStitchedLength') as HTMLElement,
    panelStitchedLengthValue: document.getElementById(
      'panelStitchedLengthValue',
    ) as HTMLSpanElement,
  };
}

/**
 * Selects the controls and preview owned by the sheet layout
 */
export function createPageElements(): PageElements {
  return {
    svgHost: document.getElementById('pageSvgHost'),
    downloadSvg: document.getElementById('downloadPageSvg') as HTMLButtonElement,
    zoom: document.getElementById('pageZoom') as HTMLInputElement,
    zoomIn: document.getElementById('pageZoomIn') as HTMLButtonElement,
    zoomOut: document.getElementById('pageZoomOut') as HTMLButtonElement,
    zoomReset: document.getElementById('pageZoomReset') as HTMLButtonElement,
    zoomLabel: document.getElementById('pageZoomLabel') as HTMLSpanElement,
    showGrid: document.getElementById('pageShowGrid') as HTMLInputElement,
    materialInfoContainer: document.getElementById('materialInfoContainer') as HTMLElement,
    materialDimensions: document.getElementById('materialDimensions') as HTMLElement,
    dimensionsValue: document.getElementById('dimensionsValue') as HTMLSpanElement,
    materialUtilization: document.getElementById('materialUtilization') as HTMLElement,
    utilizationValue: document.getElementById('utilizationValue') as HTMLSpanElement,
    resetLayoutSettings: document.getElementById('resetLayoutSettings') as HTMLButtonElement,
    // Panel info elements (only exist in main panel preview)
  };
}

/**
 * Gets layout-specific DOM elements
 */
export function getLayoutElements(): LayoutElements {
  return {
    nesting: {},
    nestingGap: document.getElementById('nestingGap') as HTMLInputElement | null,
    nestingQuarterTurn: document.getElementById('nestingQuarterTurn') as HTMLInputElement | null,
    pagePadding: document.getElementById('pagePadding') as HTMLInputElement | null,
    pagePaddingNumber: document.getElementById('pagePaddingNumber') as HTMLInputElement | null,
    pageRows: document.getElementById('pageRows') as HTMLInputElement | null,
    pageRowsNumber: document.getElementById('pageRowsNumber') as HTMLInputElement | null,
    pageCols: document.getElementById('pageCols') as HTMLInputElement | null,
    pageColsNumber: document.getElementById('pageColsNumber') as HTMLInputElement | null,
    pageHSpace: document.getElementById('pageHSpace') as HTMLInputElement | null,
    pageHSpaceNumber: document.getElementById('pageHSpaceNumber') as HTMLInputElement | null,
    pageVSpace: document.getElementById('pageVSpace') as HTMLInputElement | null,
    pageVSpaceNumber: document.getElementById('pageVSpaceNumber') as HTMLInputElement | null,
    pageInvert: document.getElementById('pageInvert') as HTMLInputElement | null,
    nestingOffset: document.getElementById('nestingOffset') as HTMLInputElement | null,
    nestingOffsetNumber: document.getElementById('nestingOffsetNumber') as HTMLInputElement | null,
    nestingOffsetRow: document.getElementById('nestingOffsetRow') as HTMLElement | null,
  };
}

/**
 * Validates that critical DOM elements exist
 */
export function validateCriticalElements(el: PanelElements): boolean {
  const critical = [el.shape, el.side, el.seam, el.curved, el.stitches, el.dotSize, el.svgHost];
  const missing = critical.filter((element) => !element);

  if (missing.length > 0) {
    console.error('Critical DOM elements missing:', missing);
    return false;
  }

  return true;
}
