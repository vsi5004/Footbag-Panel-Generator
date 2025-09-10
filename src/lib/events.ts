// Event handling for the footbag panel generator
// Centralizes all UI event binding and event handler logic

import type { DOMElements, Panel, PanelConfig } from '../types';

export interface EventHandlers {
  render: () => void;
  renderLayout: (panel: Panel | null, dotSize: number) => void;
  applyGridVisibility: () => void;
  updatePageOverflow: () => void;
}

/**
 * Resets panel settings to default values
 */
export function resetPanelSettings(el: DOMElements, ui: any, render: () => void): void {
  // Reset all panel controls to their default values
  if (el.shape) el.shape.value = '5'; // Pentagon
  if (el.curved) el.curved.checked = false; // Straight edges
  if (el.side) el.side.value = '30'; // 30mm side length
  if (el.seam) el.seam.value = '5'; // 5mm seam allowance
  if (el.stitches) el.stitches.value = '10'; // 10 stitch holes per side
  if (el.cornerMargin) el.cornerMargin.value = '6'; // 6mm corner margin
  if (el.holeSpacing) el.holeSpacing.value = '3'; // 3mm hole spacing
  if (el.dotSize) el.dotSize.value = '1'; // 1mm dot size
  if (el.curveFactor) el.curveFactor.value = '0.30'; // Default curve factor
  if (el.hexType) el.hexType.value = 'truncated'; // Truncated triangle
  if (el.hexLong) el.hexLong.value = '30'; // 30mm long side
  if (el.hexRatio) el.hexRatio.value = '0.5'; // 0.5 ratio
  
  // Update UI visibility and sync number displays
  ui.updateVisibility(el);
  ui.syncPair(el.side!, el.sideNumber!, () => {});
  ui.syncPair(el.seam!, el.seamNumber!, () => {});
  ui.syncPair(el.stitches!, el.stitchesNumber!, () => {});
  ui.syncPair(el.cornerMargin!, el.cornerMarginNumber!, () => {});
  ui.syncPair(el.holeSpacing!, el.holeSpacingNumber!, () => {});
  ui.syncPair(el.dotSize!, el.dotSizeNumber!, () => {});
  if (el.curveFactor && el.curveFactorNumber) {
    ui.syncPair(el.curveFactor, el.curveFactorNumber, () => {});
  }
  if (el.hexLong && el.hexLongNumber) {
    ui.syncPair(el.hexLong, el.hexLongNumber, () => {});
  }
  if (el.hexRatio && el.hexRatioNumber) {
    ui.syncPair(el.hexRatio, el.hexRatioNumber, () => {});
  }
  
  // Re-render the panel with default values
  render();
}

/**
 * Resets layout settings to default values
 */
export function resetLayoutSettings(layoutEl: any, renderLayout: (panel: Panel | null, dotSize: number, config?: PanelConfig) => void, lastPanel: Panel | null, lastDotSize: number, config?: PanelConfig): void {
  const { pageRows, pageRowsNumber, pageCols, pageColsNumber, pageHSpace, pageHSpaceNumber, 
          pageVSpace, pageVSpaceNumber, pageInvert, nestingOffset, nestingOffsetNumber, 
          nestingOffsetRow } = layoutEl;
  const { pageEl } = layoutEl;
          
  // Reset all layout controls to their default values
  if (pageRows) pageRows.value = '3';
  if (pageRowsNumber) pageRowsNumber.value = '3';
  if (pageCols) pageCols.value = '3';
  if (pageColsNumber) pageColsNumber.value = '3';
  if (pageHSpace) pageHSpace.value = '20';
  if (pageHSpaceNumber) pageHSpaceNumber.value = '0';
  if (pageVSpace) pageVSpace.value = '1';
  if (pageVSpaceNumber) pageVSpaceNumber.value = '1';
  if (pageInvert) pageInvert.checked = false;
  if (nestingOffset) nestingOffset.value = '0';
  if (nestingOffsetNumber) nestingOffsetNumber.value = '0';
  if (pageEl.showGrid) pageEl.showGrid.checked = true;
  
  // Hide nesting controls since inverted nesting is now off
  if (nestingOffsetRow) nestingOffsetRow.classList.add('hidden');
  
  // Re-render the layout with default values
  renderLayout(lastPanel, lastDotSize, config);
}

/**
 * Creates a download link for SVG content
 */
export function downloadSvg(svg: SVGElement, filename: string): void {
  const clone = svg.cloneNode(true) as SVGElement;
  clone.style.background = 'white';
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.download = filename;
  downloadLink.href = url;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  URL.revokeObjectURL(url);
}

/**
 * Creates filename for single panel download
 */
export function createPanelFilename(el: DOMElements): string {
  const shapeBase = {3:'tri',4:'sq',5:'penta',6:'hexa'}[parseInt(el.shape?.value ?? '5', 10)] || 'panel';
  const useTrunc = (parseInt(el.shape?.value ?? '5', 10) === 6 && el.hexType?.value === 'truncated');
  const shapeLabel = useTrunc ? `${shapeBase}-trunc` : shapeBase;
  const sizeLabel = useTrunc ? 
    `${el.hexLong?.value ?? '30'}mmL-${el.hexRatio?.value ?? '0.5'}r` : 
    `${el.side?.value ?? '30'}mm-side`;
  return `footbag-${shapeLabel}-${sizeLabel}-${el.stitches?.value ?? '10'}st-${el.curved?.checked ? 'curved' : 'straight'}.svg`;
}

/**
 * Creates filename for layout download
 */
export function createLayoutFilename(layoutEl: any): string {
  const { pageRows, pageCols } = layoutEl;
  return `footbag-layout-${(pageRows?.value || '3')}x${(pageCols?.value || '3')}.svg`;
}

/**
 * Handles settings export functionality
 */
export function exportSettings(el: DOMElements): void {
  const STATE = window.FB.state;
  if (!STATE) return;
  
  const settings = STATE.collect(el);
  const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  const shapeBase = {3:'tri',4:'sq',5:'penta',6:'hexa'}[parseInt(el.shape?.value ?? '5', 10)] || 'panel';
  const ts = new Date().toISOString().replace(/[:.]/g,'-');
  downloadLink.download = `footbag-${shapeBase}-settings-${ts}.json`;
  downloadLink.href = url;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  URL.revokeObjectURL(url);
}

/**
 * Handles settings import functionality
 */
export function setupImportSettings(el: DOMElements, ui: any, render: () => void): void {
  const STATE = window.FB.state;
  if (!el.importSettings || !el.importFile || !STATE) return;
  
  el.importSettings.addEventListener('click', () => el.importFile?.click());
  el.importFile.addEventListener('change', () => {
    const file = el.importFile!.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || '{}'));
        STATE.apply(el, data);
        ui.updateVisibility(el);
        render();
      } catch (e) {
        alert('Invalid settings file.');
      }
      el.importFile!.value = '';
    };
    reader.readAsText(file);
  });
}

/**
 * Sets up horizontal spacing sync with negative value mapping
 */
export function setupHorizontalSpacingSync(layoutEl: any, renderLayout: (panel: Panel | null, dotSize: number) => void, getLastPanel: () => Panel | null, getLastDotSize: () => number): void {
  const { pageHSpace, pageHSpaceNumber } = layoutEl;
  if (!pageHSpace || !pageHSpaceNumber) return;
  
  const syncHSpaceFromSlider = () => {
    const sliderVal = parseInt(pageHSpace.value, 10);
    // Map slider: 0-20 → -20 to 0mm, 21-70 → 1 to 50mm
    const actualVal = sliderVal <= 20 ? (sliderVal - 20) : (sliderVal - 19);
    pageHSpaceNumber.value = actualVal.toString();
    renderLayout(getLastPanel(), getLastDotSize());
  };
  
  const syncHSpaceFromNumber = () => {
    const numberVal = parseInt(pageHSpaceNumber.value, 10);
    // Map number: -20 to 0mm → 0-20 slider, 1 to 50mm → 21-70 slider
    const sliderVal = numberVal <= 0 ? (numberVal + 20) : (numberVal + 19);
    pageHSpace.value = Math.max(0, Math.min(70, sliderVal)).toString();
    renderLayout(getLastPanel(), getLastDotSize());
  };
  
  pageHSpace.addEventListener('input', syncHSpaceFromSlider);
  pageHSpaceNumber.addEventListener('input', syncHSpaceFromNumber);
  
  // Initialize the display
  syncHSpaceFromSlider();
}
