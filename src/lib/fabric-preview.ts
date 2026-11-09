import type { LayoutElements } from '../types';
import { MAX_STOCK_MM } from './stock-nesting';

/** Fabric dimensions are actual mm; the layout preview uses base-design mm. */
export function fabricPreviewSize(
  layout: Pick<LayoutElements, 'nestingStockWidth' | 'nestingStockHeight'>,
  scalePercent: number,
) {
  const width = Number(layout.nestingStockWidth?.value),
    height = Number(layout.nestingStockHeight?.value);
  if (
    ![width, height].every((n) => Number.isFinite(n) && n >= 1 && n <= MAX_STOCK_MM) ||
    !Number.isFinite(scalePercent) ||
    scalePercent <= 0
  )
    return undefined;
  return {
    width: (width * 100) / scalePercent,
    height: (height * 100) / scalePercent,
    label: `Fabric ${width} × ${height} mm`,
  };
}

/** A sibling layer keeps the fabric reference out of SVG and GCode exports.
 * Minimum canvas dimensions coexist with the temporary nesting comparison layer.
 */
export function updateFabricPreview(wrap: HTMLElement, size: ReturnType<typeof fabricPreviewSize>) {
  let boundary = wrap.querySelector<HTMLDivElement>('[data-fabric-preview]');
  wrap.style.minWidth = size ? `${size.width}mm` : '';
  wrap.style.minHeight = size ? `${size.height}mm` : '';
  if (!size) {
    boundary?.remove();
    return;
  }
  if (!boundary) {
    boundary = document.createElement('div');
    boundary.dataset.fabricPreview = '';
    boundary.className = 'fabric-boundary';
    boundary.setAttribute('role', 'img');
    const label = document.createElement('span');
    label.className = 'fabric-boundary-label';
    boundary.append(label);
    wrap.append(boundary);
  }
  boundary.style.width = `${size.width}mm`;
  boundary.style.height = `${size.height}mm`;
  boundary.setAttribute('aria-label', size.label);
  boundary.title = `${size.label}; preview reference`;
  boundary.firstElementChild!.textContent = size.label;
}
