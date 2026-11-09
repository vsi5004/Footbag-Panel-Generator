import { applyEditableLayout } from './editable-layout';
// Event handling for the footbag panel generator
// Centralizes all UI event binding and event handler logic

import type {
  PanelElements,
  Panel,
  PanelConfig,
  LayoutElements,
  LayoutSettingsElements,
} from '../types';
import { createExportSvg, normalizeExportScale } from './export';
import { syncPairDisplay, ui as appUi } from './ui';
import { applyNestingPreferences } from './nesting-preferences';
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
  applyEditableLayout(layoutEl);
  if (layoutEl.nesting) layoutEl.nesting.active = undefined;
  applyNestingPreferences(layoutEl);
  for (const [range, display] of layoutControlPairs(layoutEl)) {
    if (!range) continue;
    range.value = range.defaultValue;
    syncPairDisplay(range, display);
  }
  for (const checkbox of [layoutEl.pageInvert, layoutEl.pageEl?.showGrid]) {
    if (checkbox) checkbox.checked = checkbox.defaultChecked;
  }
  layoutEl.nestingOffsetRow?.classList.toggle('hidden', !layoutEl.pageInvert?.checked);

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
  layoutEl: Pick<LayoutElements, 'pageRows' | 'pageCols' | 'nesting' | 'editable'>,
): string {
  const { pageRows, pageCols } = layoutEl;
  if (layoutEl.editable?.current)
    return 'footbag-layout-' + layoutEl.editable.current.count + 'panels.svg';
  if (layoutEl.nesting?.active)
    return 'footbag-nested-' + layoutEl.nesting.active.placements.length + 'panels.svg';
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
): void {
  if (!el.importSettings || !el.importFile) return;

  let importGeneration = 0;

  el.importSettings.addEventListener('click', () => el.importFile?.click());
  el.importFile.addEventListener('change', () => {
    const file = el.importFile!.files?.[0];
    if (!file) return;
    const generation = ++importGeneration;
    const reader = new FileReader();
    reader.onload = () => {
      if (generation !== importGeneration) return;
      try {
        const data = JSON.parse(String(reader.result || '{}'));
        STATE.apply(el, data, layoutEl);

        for (const [range, display] of panelControlPairs(el)) syncPairDisplay(range, display);
        if (layoutEl) {
          for (const [range, display] of layoutControlPairs(layoutEl))
            syncPairDisplay(range, display);
        }

        // Imports start at 100%; subsequent renders preserve the selected zoom.
        if (layoutEl?.pageEl) appUi.zoom.setPct(layoutEl.pageEl, 100);

        ui.updateVisibility(el);
        layoutEl?.nestingOffsetRow?.classList.toggle('hidden', !layoutEl.pageInvert?.checked);
        render();
      } catch {
        alert('Invalid settings file.');
      }
      el.importFile!.value = '';
    };
    reader.onerror = () => {
      if (generation !== importGeneration) return;
      alert('Unable to read settings file.');
      el.importFile!.value = '';
    };
    reader.readAsText(file);
  });
}
