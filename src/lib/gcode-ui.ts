import type { PageElements } from '../types';
import { layoutPreviewSource } from './layout-preview';
import { normalizeExportScale } from './export';
import { generateGcode, gcodeNumber } from './gcode';
import { applyGcodeSettings, collectGcodeSettings } from './gcode-settings';
import { parseGcode } from './gcode-preview';

export function initializeGcode(page: PageElements, flush: () => void, revalidate: () => void) {
  const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const generate = byId<HTMLButtonElement>('generateGcode'),
    download = byId<HTMLButtonElement>('exportGcode');
  const status = byId<HTMLParagraphElement>('gcodeStatus'),
    stats = byId<HTMLParagraphElement>('gcodeStats');
  const code = byId<HTMLTextAreaElement>('gcodeCode'),
    host = byId<HTMLDivElement>('gcodeViewport');
  const view = byId<HTMLSelectElement>('gcodeView'),
    travel = byId<HTMLInputElement>('gcodeShowTravel');
  if (!generate || !page.svgHost) return;
  applyGcodeSettings();
  let result: ReturnType<typeof generateGcode> | undefined;
  let svg: SVGSVGElement | undefined;
  let original = [0, 0, 100, 100],
    box = original.slice();
  const observer = new MutationObserver(() => invalidate());
  observer.observe(page.svgHost, { subtree: true, childList: true, attributes: true });
  function invalidate() {
    if (!result) return;
    result = undefined;
    download.disabled = true;
    code.value = '';
    host.replaceChildren();
    stats.textContent = '';
    status.textContent =
      'Layout or settings changed. Generate GCode to update the preview and export.';
  }
  for (const event of ['input', 'change'])
    document.addEventListener(event, (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('#gcodePreview') || target.closest('.preview')) return;
      invalidate();
    });
  document.addEventListener('layout-settings-applied', invalidate);
  const showView = () => {
    code.hidden = view.value !== 'code';
    host.hidden = view.value === 'code';
    byId('gcodeToolpathControls').hidden = view.value === 'code';
  };
  view.addEventListener('change', showView);
  travel.addEventListener('change', () =>
    svg?.querySelector('[data-travel]')?.classList.toggle('hidden', !travel.checked),
  );
  const setBox = () => svg?.setAttribute('viewBox', box.join(' '));
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

  function build() {
    flush();
    revalidate();
    const sourceSvg = page.svgHost?.querySelector<SVGElement>('svg');
    const source = sourceSvg && layoutPreviewSource(sourceSvg);
    if (!source || page.downloadSvg?.disabled)
      throw new Error('Fix the lasercutter layout before generating GCode.');
    const settings = collectGcodeSettings();
    if (
      /\bM(?:0?2|30)\b/i.test(settings.startCode.replace(/\([^)]*\)/g, '').replace(/;[^\n]*/g, ''))
    )
      throw new Error('Start GCode contains a program-end command (M2/M30). Move it to End GCode.');
    const generated = generateGcode(
      source.panel,
      source.opts,
      normalizeExportScale(document.querySelector<HTMLInputElement>('[data-export-scale]')?.value),
      settings,
    );
    observer.takeRecords();
    return generated;
  }
  generate.addEventListener('click', () => {
    invalidate();
    try {
      result = build();
      code.value = result.code;
      const preview = parseGcode(result.code);
      const ns = 'http://www.w3.org/2000/svg';
      svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', 'Laser cutting and travel toolpaths, origin at lower-left');
      let x0 = 0,
        y0 = 0,
        x1 = result.sheet.width,
        y1 = result.sheet.height;
      for (const move of preview.moves)
        for (const p of [move.from, move.to]) {
          x0 = Math.min(x0, p.x);
          y0 = Math.min(y0, p.y);
          x1 = Math.max(x1, p.x);
          y1 = Math.max(y1, p.y);
        }
      const margin = Math.max(x1 - x0, y1 - y0) * 0.03 + 1;
      original = [x0 - margin, -y1 - margin, x1 - x0 + 2 * margin, y1 - y0 + 2 * margin];
      box = original.slice();
      setBox();
      const sheet = document.createElementNS(ns, 'rect');
      for (const [key, value] of Object.entries({
        x: 0,
        y: -result.sheet.height,
        width: result.sheet.width,
        height: result.sheet.height,
      }))
        sheet.setAttribute(key, String(value));
      sheet.setAttribute('class', 'gcode-sheet');
      svg.append(sheet);
      for (const cut of [false, true]) {
        const path = document.createElementNS(ns, 'path');
        path.setAttribute(
          'd',
          preview.moves
            .filter((m) => m.cut === cut)
            .map(
              (m) =>
                `M${gcodeNumber(m.from.x)} ${gcodeNumber(-m.from.y)}L${gcodeNumber(m.to.x)} ${gcodeNumber(-m.to.y)}`,
            )
            .join(' '),
        );
        path.setAttribute('class', cut ? 'gcode-cut' : 'gcode-travel');
        if (!cut) {
          path.dataset.travel = '';
          path.classList.toggle('hidden', !travel.checked);
        }
        svg.append(path);
      }
      host.replaceChildren(svg);
      stats.textContent = `${result.sheet.width.toFixed(2)} × ${result.sheet.height.toFixed(2)} mm · ${result.paths.length} cuts · Cut: ${preview.cutDistance.toFixed(1)} mm · Travel: ${preview.travelDistance.toFixed(1)} mm`;
      status.textContent = preview.warnings.length
        ? `Generated. Custom commands not simulated: ${preview.warnings.join(', ')}. Verify these on your machine; displayed distances exclude unsupported motion.`
        : 'Ready to export. Toolpath includes start/end linear moves; initial position assumed X0 Y0.';
      download.disabled = false;
    } catch (error) {
      result = undefined;
      download.disabled = true;
      status.textContent = error instanceof Error ? error.message : 'Unable to generate GCode';
    }
  });
  download.addEventListener('click', () => {
    if (!result) return;
    try {
      const current = build();
      if (current.code !== result.code) {
        invalidate();
        return;
      }
      const url = URL.createObjectURL(new Blob([result.code], { type: 'text/plain' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `footbag-layout-${result.paths.filter((p) => p.kind === 'panel').length}panels.gcode`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      invalidate();
      status.textContent = error instanceof Error ? error.message : 'Unable to export GCode';
    }
  });
  byId('resetGcodeSettings').addEventListener('click', () => {
    applyGcodeSettings();
    invalidate();
  });
  showView();
}
