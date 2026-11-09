import type { Panel } from '../types';
import { CONSTANTS } from './constants';
import { createLayoutSvg, measureLayoutSvg, type LayoutSvgOptions } from './layout';
import { measurePlaced } from './nesting-types';
import { updateSvgGrid } from './svg-grid';

interface Preview {
  panel: Panel;
  dot: number;
  nested: boolean;
  groups: Element[];
  gridKey: string;
}
const previews = new WeakMap<SVGElement, Preview>();
const sources = new WeakMap<SVGElement, { panel: Panel; opts: LayoutSvgOptions }>();
export const layoutPreviewSource = (svg: SVGElement) => sources.get(svg);

function frame(panel: Panel, opts: LayoutSvgOptions) {
  if (opts.optimized) {
    const box = measurePlaced(
      panel,
      opts.optimized.placements,
      opts.dotDiameter,
      opts.padding ?? 10,
    );
    return { viewMinX: box.minX, viewMinY: box.minY, width: box.width, height: box.height };
  }
  const { width, height } = measureLayoutSvg(panel, opts);
  const padding = opts.padding ?? 10;
  return {
    viewMinX: -padding,
    viewMinY:
      -padding +
      (opts.invertOdd && opts.nestingVerticalOffset < 0 ? opts.nestingVerticalOffset : 0),
    width,
    height,
  };
}
function attribute(node: Element, name: string, value: string) {
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}

/** Keep unchanged panel drawings; rebuild when panel, dot size, count or SVG structure changes. */
export function updateLayoutPreview(
  panel: Panel,
  opts: LayoutSvgOptions,
  existing?: SVGElement | null,
): SVGElement {
  const previous = existing ? previews.get(existing) : undefined;
  const nested = !!opts.optimized;
  const count = opts.optimized?.placements.length ?? opts.rows * opts.cols;
  const box = frame(panel, opts),
    gridKey = JSON.stringify([box, opts.showGrid]);
  if (
    !existing ||
    !previous ||
    previous.panel !== panel ||
    previous.dot !== opts.dotDiameter ||
    previous.nested !== nested ||
    previous.groups.length !== count
  ) {
    const svg = createLayoutSvg(panel, opts);
    sources.set(svg, { panel, opts });
    previews.set(svg, {
      panel,
      dot: opts.dotDiameter,
      nested,
      groups: Array.from(svg.children).filter((child) => child.id !== 'grid'),
      gridKey,
    });
    return svg;
  }
  attribute(existing, 'width', box.width + 'mm');
  sources.set(existing, { panel, opts });
  attribute(existing, 'height', box.height + 'mm');
  attribute(
    existing,
    'viewBox',
    [box.viewMinX, box.viewMinY, box.width, box.height].map((n) => n.toFixed(3)).join(' '),
  );
  if (previous.gridKey !== gridKey) {
    updateSvgGrid(existing, box, opts.showGrid);
    previous.gridKey = gridKey;
  }
  if (opts.optimized) {
    for (let i = 0; i < count; i++) {
      const at = opts.optimized.placements[i];
      attribute(
        previous.groups[i],
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
    }
  } else {
    const { cellW, cellH, renderPad } = measureLayoutSvg(panel, opts);
    const margin = CONSTANTS.LAYOUT.MARGIN_MM;
    const dx0 = -(panel.bounds.viewMinX + margin),
      dy0 = -(panel.bounds.viewMinY + margin);
    // Match the factory's arithmetic and rounding, including its nested flip group.
    const panelMinY = panel.bounds.viewMinY,
      panelMaxY = panelMinY + panel.bounds.height;
    const flipCenter = (panelMinY + panelMaxY) / 2;
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / opts.cols),
        col = i % opts.cols,
        group = previous.groups[i];
      const x = col * (cellW + opts.hSpace) + dx0 + renderPad;
      const y = row * (cellH + opts.vSpace) + dy0 + renderPad;
      attribute(group, 'transform', 'translate(' + x.toFixed(3) + ' ' + y.toFixed(3) + ')');
      const inner = group.firstElementChild!;
      if (opts.invertOdd && col % 2 === 1)
        attribute(
          inner,
          'transform',
          'matrix(1 0 0 -1 0 ' + (2 * flipCenter + opts.nestingVerticalOffset).toFixed(3) + ')',
        );
      else inner.removeAttribute('transform');
    }
  }
  return existing;
}
