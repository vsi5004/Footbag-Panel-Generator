// Event handling for the footbag panel generator
// Centralizes all UI event binding and event handler logic

import type {
  PanelElements,
  Panel,
  PanelConfig,
  LayoutElements,
  LayoutSettingsElements,
  RenderLayout,
} from '../types';
import { createExportSvg, normalizeExportScale } from './export';
import { syncPairDisplay, ui as appUi } from './ui';
import { state as STATE } from './state';
import { panelControlPairs, layoutControlPairs } from './controls';

/**
 * Resets panel settings to default values
 */
export function resetPanelSettings(el: PanelElements, ui: typeof appUi, render: () => void): void {
  // Use the defaults declared by the controls so Reset matches a fresh page.
  for (const select of [el.shape, el.hexType]) {
    if (select)
      select.selectedIndex = Math.max(
        0,
        Array.from(select.options).findIndex((option) => option.defaultSelected),
      );
  }
  for (const checkbox of [el.curved, el.showHoles, el.cornerStitchSpacing, el.showGrid]) {
    if (checkbox) checkbox.checked = checkbox.defaultChecked;
  }

  for (const [range, display] of panelControlPairs(el)) {
    if (!range) continue;
    // Constraints from the previous design must not clamp the reset value.
    // The next render recomputes dynamic bounds for the default design.
    const value = Number(range.defaultValue);
    if (range.min !== '' && Number(range.min) > value) range.min = String(value);
    if (range.max !== '' && Number(range.max) < value) range.max = String(value);
    range.value = range.defaultValue;
    syncPairDisplay(range, display);
  }
  ui.updateVisibility(el);

  // Re-render the panel with default values
  render();
}

/**
 * Resets layout settings to default values
 */
export function resetLayoutSettings(
  layoutEl: LayoutSettingsElements,
  renderLayout: (panel: Panel | null, dotSize: number, config?: PanelConfig) => void,
  lastPanel: Panel | null,
  lastDotSize: number,
  config?: PanelConfig,
): void {
  const {
    pagePadding,
    pagePaddingNumber,
    pageRows,
    pageRowsNumber,
    pageCols,
    pageColsNumber,
    pageHSpace,
    pageHSpaceNumber,
    pageVSpace,
    pageVSpaceNumber,
    pageInvert,
    nestingOffset,
    nestingOffsetNumber,
    nestingOffsetRow,
  } = layoutEl;
  const { pageEl } = layoutEl;

  // Reset all layout controls to their default values
  if (pagePadding) pagePadding.value = '10';
  if (pagePaddingNumber) pagePaddingNumber.value = '10';
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
  if (pageEl?.showGrid) pageEl.showGrid.checked = true;

  // Hide nesting controls since inverted nesting is now off
  if (nestingOffsetRow) nestingOffsetRow.classList.add('hidden');

  // Re-render the layout with default values
  renderLayout(lastPanel, lastDotSize, config);
}

/**
 * Creates a download link for SVG content
 */
export function downloadSvg(svg: SVGElement, filename: string, scalePercent: number = 100): void {
  scalePercent = normalizeExportScale(scalePercent);
  const clone = createExportSvg(svg, scalePercent);
  if (scalePercent !== 100) filename = filename.replace(/\.svg$/, `-${scalePercent}pct.svg`);
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
    type: 'image/svg+xml;charset=utf-8',
  });
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
export function createPanelFilename(el: PanelElements): string {
  const shapeBase =
    { 3: 'tri', 4: 'sq', 5: 'penta', 6: 'hexa' }[parseInt(el.shape?.value ?? '5', 10)] || 'panel';
  const useTrunc = parseInt(el.shape?.value ?? '5', 10) === 6 && el.hexType?.value === 'truncated';
  const shapeLabel = useTrunc ? `${shapeBase}-trunc` : shapeBase;
  const sizeLabel = useTrunc
    ? `${el.hexLong?.value ?? '30'}mmL-${el.hexRatio?.value ?? '0.5'}r`
    : `${el.side?.value ?? '30'}mm-side`;
  return `footbag-${shapeLabel}-${sizeLabel}-${el.stitches?.value ?? '10'}st-${el.curved?.checked ? 'curved' : 'straight'}.svg`;
}

/**
 * Creates filename for layout download
 */
export function createLayoutFilename(
  layoutEl: Pick<LayoutElements, 'pageRows' | 'pageCols'>,
): string {
  const { pageRows, pageCols } = layoutEl;
  return `footbag-layout-${pageRows?.value || '3'}x${pageCols?.value || '3'}.svg`;
}

/**
 * Handles settings export functionality
 */
export function exportSettings(el: PanelElements, layoutEl?: LayoutSettingsElements): void {
  const settings = STATE.collect(el, layoutEl);
  const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  const shapeBase =
    { 3: 'tri', 4: 'sq', 5: 'penta', 6: 'hexa' }[parseInt(el.shape?.value ?? '5', 10)] || 'panel';
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
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
export function setupImportSettings(
  el: PanelElements,
  ui: typeof appUi,
  render: () => void,
  layoutEl?: LayoutSettingsElements,
  renderLayout?: RenderLayout,
): void {
  if (!el.importSettings || !el.importFile) return;

  el.importSettings.addEventListener('click', () => el.importFile?.click());
  el.importFile.addEventListener('change', () => {
    const file = el.importFile!.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || '{}'));
        STATE.apply(el, data, layoutEl);

        for (const [range, display] of panelControlPairs(el)) syncPairDisplay(range, display);
        if (layoutEl) {
          for (const [range, display] of layoutControlPairs(layoutEl))
            syncPairDisplay(range, display);
        }

        // Reset layout zoom to a reasonable level after import
        if (layoutEl?.pageEl) {
          // Reset the layout state to treat this as a fresh render
          if (layoutEl.layoutState) {
            layoutEl.layoutState.isFirstLayoutRender = true;
          }
          // Set zoom to 100% initially, the auto-fit logic will adjust if needed
          appUi.zoom.setPct(layoutEl.pageEl, 100);
        }

        ui.updateVisibility(el);
        render();
        if (renderLayout) {
          renderLayout(null, parseFloat(el.dotSize?.value || '1'));
        }
      } catch {
        alert('Invalid settings file.');
      }
      el.importFile!.value = '';
    };
    reader.readAsText(file);
  });
}
