import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

globalThis.window = new JSDOM(
  readFileSync(new URL('../index.html', import.meta.url), 'utf8'),
).window;
globalThis.document = window.document;
await import('../src/lib/geometry.ts');
await import('../src/lib/stitches.ts');
await import('../src/lib/svg.ts');
const { computePanel } = await import('../src/lib/renderer.ts');
const { createLayoutSvg, calculateMaterialUtilization } = await import('../src/lib/layout.ts');
const { createExportSvg } = await import('../src/lib/export.ts');
const { collectInputValues, computeGeometry, updateDynamicConstraints } =
  await import('../src/lib/validation.ts');
const { createMainElements } = await import('../src/lib/dom.ts');

const hash = (value) =>
  createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(value))
    .digest('hex');

export function captureCases() {
  const result = {};
  for (const [nSides, hexType] of [
    [3, 'regular'],
    [4, 'regular'],
    [5, 'regular'],
    [6, 'regular'],
    [6, 'truncated'],
    [10, 'regular'],
  ]) {
    for (const curvedEdges of [false, true]) {
      for (const mode of ['normal', 'no-holes', 'bunched-corners']) {
        const config = {
          nSides,
          hexType,
          curvedEdges,
          sideLen: 30,
          seamOffset: 5,
          stitchCount: mode === 'no-holes' ? 0 : 8,
          hexLong: 32,
          hexRatio: 0.45,
          curveRadius: 60,
          holeSpacing: 3,
          holeBunching: mode === 'bunched-corners' ? 0.5 : 0,
          cornerMargin: 2,
          starRootOffset: -1.5,
          starRootAngle: 128,
          cornerStitchSpacing: mode === 'bunched-corners',
          cornerStitchDistance: 2.5,
        };
        const panel = computePanel(config);
        const options = {
          rows: 2,
          cols: 3,
          hSpace: -2,
          vSpace: 4,
          dotDiameter: 1,
          showGrid: true,
          invertOdd: true,
          nestingVerticalOffset: -3,
          padding: 10,
        };
        const sheet = createLayoutSvg(panel, options);
        const el = createMainElements();
        el.shape.value = String(nSides);
        el.hexType.value = hexType;
        el.curved.checked = curvedEdges;
        el.showHoles.checked = mode !== 'no-holes';
        const uiConfig = collectInputValues(el);
        const constraints = updateDynamicConstraints(uiConfig, computeGeometry(uiConfig), el);
        result[`${nSides}-${hexType}-${curvedEdges}-${mode}`] = {
          panel: hash(panel),
          sheet: hash(sheet.outerHTML),
          exports: [75, 100, 125].map((scale) => hash(createExportSvg(sheet, scale).outerHTML)),
          utilization: calculateMaterialUtilization(panel, options, config),
          constraints,
        };
      }
    }
  }
  return result;
}
