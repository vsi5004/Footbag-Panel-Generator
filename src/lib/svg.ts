import type { Panel } from '../types';
import { CONSTANTS } from './constants';
import { utils } from './utils';

const { COLORS, STROKES, LAYOUT } = CONSTANTS;

function createSvg(panel: Panel, options: { dotDiameter: number; showGrid?: boolean }): SVGElement {
  const { outlinePath, stitches, bounds } = panel;
  const { dotDiameter, showGrid = true } = options;
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', `${bounds.width}mm`);
  svg.setAttribute('height', `${bounds.height}mm`);
  svg.setAttribute('viewBox', `${bounds.viewMinX.toFixed(3)} ${bounds.viewMinY.toFixed(3)} ${bounds.width.toFixed(3)} ${bounds.height.toFixed(3)}`);
  svg.setAttribute('fill', 'none');
  svg.style.background = 'white';

  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', outlinePath);
  path.setAttribute('stroke', COLORS.cut);
  path.setAttribute('stroke-width', `${STROKES.cut}mm`);
  path.setAttribute('fill', 'none');

  const marks = document.createElementNS(svg.namespaceURI, 'g');
  marks.setAttribute('fill', COLORS.seam);
  const r = Math.max(0.1, dotDiameter / 2);
  
  for (const p of stitches) {
    const c = document.createElementNS(svg.namespaceURI, 'circle');
    c.setAttribute('cx', p.x.toFixed(3));
    c.setAttribute('cy', p.y.toFixed(3));
    c.setAttribute('r', r.toString());
    c.setAttribute('fill', COLORS.seam);
    marks.appendChild(c);
  }

  if (showGrid) {
    const grid = utils.createGrid(svg, bounds, LAYOUT.GRID_SPACING_MM);
    svg.appendChild(grid);
  }
  svg.appendChild(path);
  svg.appendChild(marks);
  return svg;
}

export const svg = { createSvg };

// For backward compatibility with global window.FB
window.FB = window.FB || {};
window.FB.svg = svg;
