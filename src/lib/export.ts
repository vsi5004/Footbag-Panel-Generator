import { utils } from './utils';
import { CONSTANTS } from './constants';
import { normalizeSetting, SETTINGS } from './settings';

/** Shared bounds for the export control and imported settings. */
export function normalizeExportScale(value: unknown): number {
  const scale = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof scale === 'number' && Number.isFinite(scale) && scale > 0
    ? normalizeSetting('exportScale', scale)
    : SETTINGS.exportScale.default;
}

/** Scale physical output dimensions while preserving the base design and viewBox. */
export function createExportSvg(svg: SVGElement, scalePercent: number = 100): SVGElement {
  const clone = svg.cloneNode(true) as SVGElement;
  const scale = normalizeExportScale(scalePercent) / 100;
  for (const dimension of ['width', 'height']) {
    const mm = Number.parseFloat(svg.getAttribute(dimension) || '');
    if (!Number.isFinite(mm) || mm <= 0) throw new Error('Invalid SVG dimensions');
    clone.setAttribute(dimension, `${mm * scale}mm`);
  }
  // Preview CSS must not override the physical dimensions of a downloaded SVG.
  clone.style.removeProperty('max-width');
  clone.style.removeProperty('width');
  clone.style.removeProperty('height');
  clone.style.removeProperty('transform');
  clone.style.background = 'white';

  // Keep the reference grid at actual 10 mm spacing even when the template scales.
  const grid = clone.querySelector('#grid');
  if (grid && scale !== 1) {
    const [viewMinX, viewMinY, width, height] = (clone.getAttribute('viewBox') || '')
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const replacement = utils.createGrid(
      clone,
      { viewMinX, viewMinY, width, height },
      CONSTANTS.LAYOUT.GRID_SPACING_MM / scale,
    );
    grid.replaceWith(replacement);
  }
  return clone;
}
