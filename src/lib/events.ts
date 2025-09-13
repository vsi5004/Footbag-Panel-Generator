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
  if (pageHSpace) pageHSpace.value = '0';
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
export function exportSettings(el: DOMElements, layoutEl?: any): void {
  const STATE = window.FB.state;
  if (!STATE) return;
  
  const settings = STATE.collect(el, layoutEl);
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
export function setupImportSettings(el: DOMElements, ui: any, render: () => void, layoutEl?: any, renderLayout?: (panel: any, dotSize: number) => void): void {
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
        STATE.apply(el, data, layoutEl);
        
        // Manually trigger sync for all range/number pairs
        // This ensures number displays match the imported range values
        const syncPairDisplay = (range: HTMLInputElement | null, display: HTMLElement | null) => {
          if (range && display) {
            if ('value' in display) {
              (display as HTMLInputElement).value = range.value;
            } else {
              display.textContent = range.value;
            }
          }
        };
        
        // Sync all main panel pairs
        syncPairDisplay(el.side, el.sideNumber);
        syncPairDisplay(el.seam, el.seamNumber);
        syncPairDisplay(el.dotSize, el.dotSizeNumber);
        syncPairDisplay(el.cornerMargin, el.cornerMarginNumber);
        syncPairDisplay(el.curveFactor, el.curveFactorNumber);
        syncPairDisplay(el.stitches, el.stitchesNumber);
        syncPairDisplay(el.holeSpacing, el.holeSpacingNumber);
        syncPairDisplay(el.cornerStitchDistance, el.cornerStitchDistanceNumber);
        syncPairDisplay(el.starRootOffset, el.starRootOffsetNumber);
        syncPairDisplay(el.starRootAngle, el.starRootAngleNumber);
        syncPairDisplay(el.hexLong, el.hexLongNumber);
        syncPairDisplay(el.hexRatio, el.hexRatioNumber);
        
        // Sync layout pairs 
        if (layoutEl) {
          syncPairDisplay(layoutEl.pageRows, layoutEl.pageRowsNumber);
          syncPairDisplay(layoutEl.pageCols, layoutEl.pageColsNumber);
          syncPairDisplay(layoutEl.pageHSpace, layoutEl.pageHSpaceNumber);
          syncPairDisplay(layoutEl.pageVSpace, layoutEl.pageVSpaceNumber);
          syncPairDisplay(layoutEl.nestingOffset, layoutEl.nestingOffsetNumber);
        }
        
        // Reset layout zoom to a reasonable level after import
        if (layoutEl?.pageEl && window.FB.ui?.zoom) {
          // Reset the layout state to treat this as a fresh render
          if (layoutEl.layoutState) {
            layoutEl.layoutState.isFirstLayoutRender = true;
          }
          // Set zoom to 100% initially, the auto-fit logic will adjust if needed
          window.FB.ui.zoom.setPct(layoutEl.pageEl, 100);
        }
        
        ui.updateVisibility(el);
        render();
        if (renderLayout) {
          renderLayout(null, parseFloat(el.dotSize?.value || '1'));
        }
      } catch (e) {
        alert('Invalid settings file.');
      }
      el.importFile!.value = '';
    };
    reader.readAsText(file);
  });
}

/**
 * Set up horizontal spacing sync using standard syncPair behavior
 */
export function setupHorizontalSpacingSync(layoutEl: any, renderLayout: (panel: Panel | null, dotSize: number) => void, getLastPanel: () => Panel | null, getLastDotSize: () => number, ui: any): void {
  const { pageHSpace, pageHSpaceNumber } = layoutEl;
  if (!pageHSpace || !pageHSpaceNumber) return;
  
  // Use standard syncPair behavior like vertical spacing
  ui.syncPair(pageHSpace, pageHSpaceNumber, () => renderLayout(getLastPanel(), getLastDotSize()));
}
