import type { Panel } from '../types';
import { CONSTANTS } from './constants';

const { COLORS, STROKES, LAYOUT } = CONSTANTS;

function createSvg(panel: Panel, options: { dotDiameter: number }): SVGElement {
  const { outlinePath, stitches, bounds } = panel;
  const { dotDiameter } = options;
  
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

  const grid = document.createElementNS(svg.namespaceURI, 'g');
  grid.setAttribute('id', 'grid');
  grid.setAttribute('stroke', '#bfbfbf');
  grid.setAttribute('stroke-width', '0.1mm');
  grid.setAttribute('opacity', '0.22');
  
  const gridSpacing = LAYOUT.GRID_SPACING_MM;
  
  for (let x = Math.floor(bounds.viewMinX / gridSpacing) * gridSpacing; x < bounds.viewMinX + bounds.width; x += gridSpacing) {
    const l = document.createElementNS(svg.namespaceURI, 'line');
    l.setAttribute('x1', x.toFixed(3));
    l.setAttribute('y1', bounds.viewMinY.toFixed(3));
    l.setAttribute('x2', x.toFixed(3));
    l.setAttribute('y2', (bounds.viewMinY + bounds.height).toFixed(3));
    grid.appendChild(l);
  }
  
  for (let y = Math.floor(bounds.viewMinY / gridSpacing) * gridSpacing; y < bounds.viewMinY + bounds.height; y += gridSpacing) {
    const l = document.createElementNS(svg.namespaceURI, 'line');
    l.setAttribute('x1', bounds.viewMinX.toFixed(3));
    l.setAttribute('y1', y.toFixed(3));
    l.setAttribute('x2', (bounds.viewMinX + bounds.width).toFixed(3));
    l.setAttribute('y2', y.toFixed(3));
    grid.appendChild(l);
  }

  svg.appendChild(grid);
  svg.appendChild(path);
  svg.appendChild(marks);
  return svg;
}

export const svg = { createSvg };

// For backward compatibility with global window.FB
window.FB = window.FB || {};
window.FB.svg = svg;
