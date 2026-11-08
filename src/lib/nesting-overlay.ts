import type { Panel } from '../types';
import type { NestingPlan } from './nesting-types';
import { createNestedSvg } from './nested-svg';
import { measurePlaced } from './nesting-types';

interface Overlay {
  wrap: HTMLElement;
  image: HTMLImageElement;
  width: string;
  height: string;
  background: string;
  temporary: boolean;
}
const overlays = new WeakMap<HTMLElement, Overlay>();

export function clearNestingOverlay(host: HTMLElement): void {
  const previous = overlays.get(host);
  if (!previous) return;
  if (previous.temporary) previous.wrap.remove();
  else {
    previous.image.remove();
    previous.wrap.style.width = previous.width;
    previous.wrap.style.height = previous.height;
    previous.wrap.style.background = previous.background;
  }
  overlays.delete(host);
}

/** A separate image layer: the current/exportable SVG is never modified. */
export function showNestingOverlay(
  host: HTMLElement,
  panel: Panel,
  plan: NestingPlan,
  dot: number,
  padding: number,
): void {
  clearNestingOverlay(host);
  const svg = createNestedSvg(panel, plan, dot, padding, false);
  svg.style.background = 'transparent';
  for (const path of svg.querySelectorAll('path')) {
    path.setAttribute('stroke', '#16a34a');
    path.setAttribute('stroke-width', '0.35mm');
    path.setAttribute('fill', '#16a34a');
    path.setAttribute('fill-opacity', '0.12');
  }
  for (const circle of svg.querySelectorAll('circle')) circle.setAttribute('fill', '#16a34a');
  const existing = host.querySelector<HTMLElement>('.svg-wrap');
  const wrap = existing ?? document.createElement('div');
  if (!existing) {
    wrap.className = 'svg-wrap';
    host.appendChild(wrap);
  }
  const base = wrap.querySelector('svg');
  const box = measurePlaced(panel, plan.placements, dot, padding);
  const image = document.createElement('img');
  image.dataset.nestingPreview = '';
  image.alt = 'Optimized layout candidate, shown in translucent green over the current sheet';
  image.draggable = false;
  image.style.width = box.width + 'mm';
  image.style.height = box.height + 'mm';
  image.src =
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(new window.XMLSerializer().serializeToString(svg));
  overlays.set(host, {
    wrap,
    image,
    width: wrap.style.width,
    height: wrap.style.height,
    background: wrap.style.background,
    temporary: !existing,
  });
  // Both sheets align at their top-left padding edge. Grow the comparison canvas
  // when needed so a larger candidate remains visible without clipping.
  wrap.style.width =
    Math.max(Number.parseFloat(base?.getAttribute('width') ?? '0'), box.width) + 'mm';
  wrap.style.height =
    Math.max(Number.parseFloat(base?.getAttribute('height') ?? '0'), box.height) + 'mm';
  wrap.style.background = 'white';
  wrap.appendChild(image);
}
