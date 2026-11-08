import type { Panel } from '../types';
import { CONSTANTS } from './constants';
import { utils } from './utils';
import { measurePlaced, type NestingPlan } from './nesting-types';
export function createNestedSvg(
  panel: Panel,
  plan: NestingPlan,
  dot: number,
  padding: number,
  showGrid: boolean,
): SVGElement {
  const box = measurePlaced(panel, plan.placements, dot, padding);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('xmlns', ns);
  svg.setAttribute('width', box.width + 'mm');
  svg.setAttribute('height', box.height + 'mm');
  svg.setAttribute(
    'viewBox',
    [box.minX, box.minY, box.width, box.height].map((n) => n.toFixed(3)).join(' '),
  );
  svg.setAttribute('fill', 'none');
  svg.style.background = 'white';
  if (showGrid)
    svg.appendChild(
      utils.createGrid(
        svg,
        { viewMinX: box.minX, viewMinY: box.minY, width: box.width, height: box.height },
        10,
      ),
    );
  const template = document.createElementNS(ns, 'g');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', panel.outlinePath);
  path.setAttribute('stroke', CONSTANTS.COLORS.cut);
  path.setAttribute('stroke-width', CONSTANTS.STROKES.cut + 'mm');
  path.setAttribute('fill', 'none');
  template.appendChild(path);
  const marks = document.createElementNS(ns, 'g');
  marks.setAttribute('fill', CONSTANTS.COLORS.seam);
  for (const p of panel.stitches) {
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', p.x.toFixed(3));
    c.setAttribute('cy', p.y.toFixed(3));
    c.setAttribute('r', Math.max(0.1, dot / 2).toFixed(3));
    c.setAttribute('fill', CONSTANTS.COLORS.seam);
    marks.appendChild(c);
  }
  template.appendChild(marks);
  for (const at of plan.placements) {
    const g = template.cloneNode(true) as SVGGElement;
    g.setAttribute(
      'transform',
      'translate(' +
        at.x +
        ' ' +
        at.y +
        ') rotate(' +
        at.angle +
        ')' +
        (at.flipY ? ' scale(1 -1)' : ''),
    );
    svg.appendChild(g);
  }
  return svg;
}
