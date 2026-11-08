import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import Ajv2020 from 'ajv/dist/2020.js';

const { window } = new JSDOM(readFileSync(new URL('../index.html', import.meta.url), 'utf8'));
globalThis.window = window;
globalThis.document = window.document;
const { createExportSvg, normalizeExportScale } = await import('../src/lib/export.ts');
const { state } = await import('../src/lib/state.ts');
const { createMainElements, getLayoutElements, createPageElements } =
  await import('../src/lib/dom.ts');
const { computePanel } = await import('../src/lib/renderer.ts');
const { createLayoutSvg } = await import('../src/lib/layout.ts');
await import('../src/lib/geometry.ts');
await import('../src/lib/stitches.ts');
const { svg: svgHelpers } = await import('../src/lib/svg.ts');

const config = {
  nSides: 5,
  sideLen: 30,
  seamOffset: 5,
  stitchCount: 10,
  curvedEdges: false,
  hexType: 'regular',
  hexLong: 30,
  hexRatio: 0.5,
  curveRadius: 60,
  holeSpacing: 3,
  holeBunching: 0,
  cornerMargin: 6,
  starRootOffset: -1.5,
  starRootAngle: 128,
  cornerStitchSpacing: false,
  cornerStitchDistance: 3,
};

test('both SVG outputs scale physical dimensions without mutating geometry or preview', () => {
  for (const variant of [
    config,
    { ...config, nSides: 10, curvedEdges: true },
    { ...config, nSides: 6, hexType: 'truncated' },
  ]) {
    const panel = computePanel(variant);
    const sources = [
      svgHelpers.createSvg(panel, { dotDiameter: 1, showGrid: true }),
      createLayoutSvg(panel, {
        rows: 3,
        cols: 2,
        hSpace: -2,
        vSpace: 1,
        dotDiameter: 1,
        showGrid: true,
        invertOdd: true,
        nestingVerticalOffset: -3,
        padding: 10,
      }),
    ];
    for (const source of sources) {
      source.style.height = 'auto';
      source.style.maxWidth = '100%';
      const original = source.outerHTML;
      for (const percent of [75, 100, 125, 150.5]) {
        const output = createExportSvg(source, percent);
        const scale = percent / 100;
        for (const attr of ['width', 'height']) {
          assert.equal(
            parseFloat(output.getAttribute(attr)),
            parseFloat(source.getAttribute(attr)) * scale,
          );
        }
        assert.equal(output.getAttribute('viewBox'), source.getAttribute('viewBox'));
        assert.deepEqual(
          [...output.querySelectorAll('path, circle')].map((x) => x.outerHTML),
          [...source.querySelectorAll('path, circle')].map((x) => x.outerHTML),
        );
        assert.ok(!output.style.height);
        assert.ok(!output.style.maxWidth);
        const lines = [...output.querySelectorAll('#grid line')].filter(
          (x) => x.getAttribute('x1') === x.getAttribute('x2'),
        );
        assert.ok(
          Math.abs(
            (Number(lines[1].getAttribute('x1')) - Number(lines[0].getAttribute('x1'))) * scale -
              10,
          ) < 0.002,
        );
        assert.equal(source.outerHTML, original);
      }
    }
  }
});

test('invalid scales default to 100 and valid scales respect bounds', () => {
  for (const value of [undefined, null, '', 'bad', NaN, Infinity, 0, -5, true, {}])
    assert.equal(normalizeExportScale(value), 100);
  assert.equal(normalizeExportScale('125.5'), 125.5);
  assert.equal(normalizeExportScale(0.5), 1);
  assert.equal(normalizeExportScale(2000), 1000);
});

test('settings round trip, old imports reset scale, and schema accepts all saved fields', () => {
  const elements = createMainElements();
  const layout = { ...getLayoutElements(), pageEl: createPageElements() };
  const validate = new Ajv2020().compile(
    JSON.parse(readFileSync(new URL('../schema/settings.schema.json', import.meta.url), 'utf8')),
  );
  elements.exportScale.value = '125.5';
  const saved = JSON.parse(JSON.stringify(state.collect(elements, layout)));
  assert.equal(validate(saved), true, JSON.stringify(validate.errors));
  assert.equal(saved.export.scalePercent, 125.5);
  state.apply(elements, saved, layout);
  assert.equal(elements.exportScale.value, '125.5');
  delete saved.export;
  assert.equal(validate(saved), true, JSON.stringify(validate.errors));
  state.apply(elements, saved, layout);
  assert.equal(elements.exportScale.value, '100');
  saved.shape = 10;
  assert.equal(validate(saved), true, JSON.stringify(validate.errors));
  saved.export = { scalePercent: 0 };
  assert.equal(validate(saved), false);
  state.apply(elements, saved, layout);
  assert.equal(elements.exportScale.value, '100');
  saved.unexpected = true;
  assert.equal(validate(saved), false);
});
