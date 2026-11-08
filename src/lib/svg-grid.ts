import { CONSTANTS } from './constants';
import { utils } from './utils';

/** Replace only the reference grid, always before the panel drawing. */
export function updateSvgGrid(
  svg: SVGElement,
  bounds: { viewMinX: number; viewMinY: number; width: number; height: number },
  enabled: boolean,
): void {
  const existing = Array.from(svg.children).find((child) => child.id === 'grid');
  if (!enabled) {
    existing?.remove();
    return;
  }
  const grid = utils.createGrid(svg, bounds, CONSTANTS.LAYOUT.GRID_SPACING_MM);
  if (existing) existing.replaceWith(grid);
  else svg.insertBefore(grid, svg.firstChild);
}
