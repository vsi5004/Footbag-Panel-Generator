// Centralizes DOM element selection and setup

import type { DOMElements } from '../types';

/**
 * Creates a DOMElements object for the main panel controls
 */
export function createMainElements(): DOMElements {
  return {
    shape: document.getElementById('shape') as HTMLSelectElement,
    side: document.getElementById('side') as HTMLInputElement,
    seam: document.getElementById('seam') as HTMLInputElement,
    curved: document.getElementById('curved') as HTMLInputElement,
    stitches: document.getElementById('stitches') as HTMLInputElement,
    dotSize: document.getElementById('dotSize') as HTMLInputElement,
    svgHost: document.getElementById('svgHost'),
    downloadSvg: document.getElementById('downloadSvg') as HTMLButtonElement,
    
    sideNumber: document.getElementById('sideNumber') as HTMLSpanElement,
    sideRow: document.getElementById('sideRow'),
    seamNumber: document.getElementById('seamNumber') as HTMLSpanElement,
    curveRadiusRow: document.getElementById('curveRadiusRow'),
    curveRadius: document.getElementById('curveRadius') as HTMLInputElement,
    curveRadiusNumber: document.getElementById('curveRadiusNumber') as HTMLSpanElement,
    stitchesNumber: document.getElementById('stitchesNumber') as HTMLSpanElement,
    cornerMargin: document.getElementById('cornerMargin') as HTMLInputElement,
    cornerMarginNumber: document.getElementById('cornerMarginNumber') as HTMLSpanElement,
    starRootOffsetRow: document.getElementById('starRootOffsetRow') as HTMLElement,
    starRootOffset: document.getElementById('starRootOffset') as HTMLInputElement,
    starRootOffsetNumber: document.getElementById('starRootOffsetNumber') as HTMLSpanElement,
    starRootAngleRow: document.getElementById('starRootAngleRow') as HTMLElement,
    starRootAngle: document.getElementById('starRootAngle') as HTMLInputElement,
    starRootAngleNumber: document.getElementById('starRootAngleNumber') as HTMLSpanElement,
    holeSpacing: document.getElementById('holeSpacing') as HTMLInputElement,
    holeSpacingNumber: document.getElementById('holeSpacingNumber') as HTMLSpanElement,
    cornerStitchSpacing: document.getElementById('cornerStitchSpacing') as HTMLInputElement,
    cornerStitchSpacingRow: document.getElementById('cornerStitchSpacingRow') as HTMLElement,
    cornerStitchDistance: document.getElementById('cornerStitchDistance') as HTMLInputElement,
    cornerStitchDistanceNumber: document.getElementById('cornerStitchDistanceNumber') as HTMLSpanElement,
    dotSizeNumber: document.getElementById('dotSizeNumber') as HTMLSpanElement,
    
    hexTypeRow: document.getElementById('hexTypeRow'),
    hexLongRow: document.getElementById('hexLongRow'),
    hexRatioRow: document.getElementById('hexRatioRow'),
    hexType: document.getElementById('hexType') as HTMLSelectElement,
    hexLong: document.getElementById('hexLong') as HTMLInputElement,
    hexLongNumber: document.getElementById('hexLongNumber') as HTMLSpanElement,
    hexRatio: document.getElementById('hexRatio') as HTMLInputElement,
    hexRatioNumber: document.getElementById('hexRatioNumber') as HTMLSpanElement,
    
    exportSettings: document.getElementById('exportSettings') as HTMLButtonElement,
    importSettings: document.getElementById('importSettings') as HTMLButtonElement,
    importFile: document.getElementById('importFile') as HTMLInputElement,
    
    zoom: document.getElementById('zoom') as HTMLInputElement,
    zoomIn: document.getElementById('zoomIn') as HTMLButtonElement,
    zoomOut: document.getElementById('zoomOut') as HTMLButtonElement,
    zoomReset: document.getElementById('zoomReset') as HTMLButtonElement,
    zoomLabel: document.getElementById('zoomLabel') as HTMLSpanElement,
    showGrid: document.getElementById('showGrid') as HTMLInputElement,
    materialInfoContainer: null, // Only exists in page layout
    materialDimensions: null, // Only exists in page layout
    dimensionsValue: null, // Only exists in page layout
    materialUtilization: null, // Only exists in page layout
    utilizationValue: null, // Only exists in page layout
    resetLayoutSettings: null, // Only exists in page layout
    resetPanelSettings: document.getElementById('resetPanelSettings') as HTMLButtonElement,
    // Panel info elements
    panelInfoContainer: document.getElementById('panelInfoContainer') as HTMLElement,
    panelSideLength: document.getElementById('panelSideLength') as HTMLElement,
    panelSideLengthValue: document.getElementById('panelSideLengthValue') as HTMLSpanElement,
    panelStitchedLength: document.getElementById('panelStitchedLength') as HTMLElement,
  panelStitchedLengthValue: document.getElementById('panelStitchedLengthValue') as HTMLSpanElement,
  };
}

/**
 * Creates a DOMElements object for the layout/page controls
 */
export function createPageElements(): DOMElements {
  return {
    shape: null,
    side: null,
    seam: null,
    curved: null,
    stitches: null,
    dotSize: null,
    svgHost: document.getElementById('pageSvgHost'),
    downloadSvg: document.getElementById('downloadPageSvg') as HTMLButtonElement,
    sideNumber: null,
    sideRow: null,
    seamNumber: null,
    curveRadiusRow: null,
    curveRadius: null,
    curveRadiusNumber: null,
    stitchesNumber: null,
    cornerMargin: null,
    cornerMarginNumber: null,
    starRootOffsetRow: null,
    starRootOffset: null,
    starRootOffsetNumber: null,
    starRootAngleRow: null,
    starRootAngle: null,
    starRootAngleNumber: null,
    holeSpacing: null,
    holeSpacingNumber: null,
    cornerStitchSpacing: null,
    cornerStitchSpacingRow: null,
    cornerStitchDistance: null,
    cornerStitchDistanceNumber: null,
    dotSizeNumber: null,
    hexTypeRow: null,
    hexLongRow: null,
    hexRatioRow: null,
    hexType: null,
    hexLong: null,
    hexLongNumber: null,
    hexRatio: null,
    hexRatioNumber: null,
    exportSettings: null,
    importSettings: null,
    importFile: null,
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
    resetPanelSettings: null, // This doesn't exist in the page layout section
    // Panel info elements (only exist in main panel preview)
    panelInfoContainer: null,
    panelSideLength: null,
    panelSideLengthValue: null,
  panelStitchedLength: null,
  panelStitchedLengthValue: null,
  };
}

/**
 * Gets layout-specific DOM elements
 */
export function getLayoutElements() {
  return {
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
export function validateCriticalElements(el: DOMElements): boolean {
  const critical = [el.shape, el.side, el.seam, el.curved, el.stitches, el.dotSize, el.svgHost];
  const missing = critical.filter(element => !element);
  
  if (missing.length > 0) {
    console.error('Critical DOM elements missing:', missing);
    return false;
  }
  
  return true;
}
