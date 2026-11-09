import type { GcodePreviewData } from './gcode-preview-data';
/** Owns SVG rendering and viewport interactions, independent of job state. */
export function createGcodeViewport(host: HTMLDivElement, travel: HTMLInputElement) {
  const byId = (id: string) => document.getElementById(id) as HTMLElement;
  let svg: SVGSVGElement | undefined;
  let original = [0, 0, 100, 100],
    box = original.slice();
  travel.addEventListener('change', () =>
    svg?.querySelector('[data-travel]')?.classList.toggle('hidden', !travel.checked),
  );
  const setBox = () => {
    svg?.setAttribute('viewBox', box.join(' '));
    byId('gcodeZoomLabel').textContent = `${Math.round((original[2] / box[2]) * 100)}%`;
  };
  function zoom(factor: number) {
    const w = Math.min(original[2] * 5, Math.max(original[2] / 30, box[2] * factor));
    const h = (w * original[3]) / original[2];
    box = [box[0] + (box[2] - w) / 2, box[1] + (box[3] - h) / 2, w, h];
    setBox();
  }
  byId('gcodeZoomIn').addEventListener('click', () => zoom(0.8));
  byId('gcodeZoomOut').addEventListener('click', () => zoom(1.25));
  byId('gcodeZoomReset').addEventListener('click', () => {
    box = original.slice();
    setBox();
  });
  host.addEventListener(
    'wheel',
    (e) => {
      if (svg) {
        e.preventDefault();
        zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15);
      }
    },
    { passive: false },
  );
  let drag: { x: number; y: number; box: number[] } | undefined;
  host.addEventListener('pointerdown', (e) => {
    if (svg) {
      drag = { x: e.clientX, y: e.clientY, box: box.slice() };
      host.setPointerCapture(e.pointerId);
    }
  });
  host.addEventListener('pointermove', (e) => {
    if (!drag || !svg) return;
    const rect = svg.getBoundingClientRect(),
      pixels = Math.min(rect.width / drag.box[2], rect.height / drag.box[3]);
    box[0] = drag.box[0] - (e.clientX - drag.x) / pixels;
    box[1] = drag.box[1] - (e.clientY - drag.y) / pixels;
    setBox();
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
    host.addEventListener(event, () => {
      drag = undefined;
    });

  return {
    clear() {
      svg = undefined;
      host.replaceChildren();
      byId('gcodeZoomLabel').textContent = '100%';
    },
    render(data: GcodePreviewData) {
      const ns = 'http://www.w3.org/2000/svg';
      svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', 'Laser cutting and travel toolpaths, origin marked at X0 Y0');
      original = data.box;
      box = original.slice();
      setBox();
      const sheet = document.createElementNS(ns, 'rect');
      for (const [key, value] of Object.entries({
        x: data.sheet.minX,
        y: -(data.sheet.minY + data.sheet.height),
        width: data.sheet.width,
        height: data.sheet.height,
      }))
        sheet.setAttribute(key, String(value));
      sheet.setAttribute('class', 'gcode-sheet');
      svg.append(sheet);
      for (const cut of [false, true]) {
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', cut ? data.cut : data.travel);
        path.setAttribute('class', cut ? 'gcode-cut' : 'gcode-travel');
        if (!cut) {
          path.dataset.travel = '';
          path.classList.toggle('hidden', !travel.checked);
        }
        svg.append(path);
      }
      const origin = document.createElementNS(ns, 'path');
      origin.setAttribute('d', 'M-2 0H2M0 -2V2');
      origin.setAttribute('class', 'gcode-origin');
      const title = document.createElementNS(ns, 'title');
      title.textContent = 'Origin (X0 Y0)';
      origin.append(title);
      svg.append(origin);
      host.replaceChildren(svg);
    },
  };
}
