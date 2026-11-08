import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { geometry } from '../src/lib/geometry.ts';
import { createMainElements } from '../src/lib/dom.ts';
import {
  collectInputValues,
  computeGeometry,
  updateDynamicConstraints,
  createPanelConfig,
} from '../src/lib/validation.ts';
import { createMainRenderFunction, computePanel } from '../src/lib/renderer.ts';

function controls() {
  globalThis.window = new JSDOM(
    readFileSync(new URL('../index.html', import.meta.url), 'utf8'),
  ).window;
  globalThis.document = window.document;
  return createMainElements();
}

test('star constraint vertices are exactly the rendered star vertices across sizes and angles', () => {
  const el = controls();
  el.shape.value = '10';
  for (const size of [10, 30, 80]) {
    for (const angle of [100, 128, 150]) {
      el.side.value = String(size);
      el.starRootAngle.value = String(angle);
      const config = collectInputValues(el);
      const result = computeGeometry(config);
      assert.deepEqual(result.verts, geometry.starVertices(size, angle));
      assert.equal(
        geometry.circularArcPath(result.verts, 0),
        computePanel(
          createPanelConfig(config, { cornerMargin: 0, holeSpacing: 1, holeBunching: 0 }),
        ).outlinePath,
      );
    }
  }
});

test('star radius and spacing limits match independent chord and arc calculations', () => {
  const el = controls();
  el.shape.value = '10';
  for (const size of [10, 30, 80])
    for (const angle of [100, 128, 150]) {
      const halfTip = ((180 - angle) * Math.PI) / 360;
      const innerRatio =
        Math.tan(halfTip) / (Math.sin(Math.PI / 5) + Math.tan(halfTip) * Math.cos(Math.PI / 5));
      const chord = size * Math.sqrt(1 + innerRatio ** 2 - 2 * innerRatio * Math.cos(Math.PI / 5));
      const minRadius = Math.max(10, Math.ceil(chord) / 2);
      for (const curved of [false, true])
        for (const count of [4, 8, 20])
          for (const margin of [0, 2, size / 4])
            for (const offset of [-3, -1.5, 1]) {
              el.side.value = String(size);
              el.starRootAngle.value = String(angle);
              el.curved.checked = curved;
              el.starRootOffset.value = String(offset);
              el.stitches.value = String(count);
              el.cornerMargin.max = String(size / 4);
              el.cornerMargin.value = String(margin);
              el.holeSpacing.value = '1';
              el.curveRadius.min = '10';
              el.curveRadius.value = '60';
              const config = collectInputValues(el);
              updateDynamicConstraints(config, computeGeometry(config), el);
              assert.ok(Math.abs(Number(el.curveRadius.min) - minRadius) < 1e-10);
              const edgeLength = curved ? 120 * Math.asin(chord / 120) : chord;
              const effectiveMargin = Math.max(margin, 3);
              const tipMargin = Math.max(0, Math.min(effectiveMargin * 2, edgeLength / 2 - 0.1));
              const rootExtension = effectiveMargin * Math.abs(config.starRootOffset);
              const maxSpacing = Math.max(
                1,
                Math.round(((edgeLength - tipMargin + rootExtension) / (count + 1)) * 25) / 10,
              );
              assert.ok(
                Math.abs(Number(el.holeSpacing.max) - maxSpacing) < 1e-10,
                `${size}/${angle}/${curved}/${count}/${margin}: ${el.holeSpacing.max} != ${maxSpacing}`,
              );
            }
    }
});

test('a live star render uses its newly constrained radius on the first frame', () => {
  const el = controls();
  el.shape.value = '10';
  el.side.value = '80';
  el.starRootAngle.value = '150';
  el.curved.checked = true;
  el.curveRadius.value = '10';
  let rendered;
  const render = createMainRenderFunction(el, (panel) => (rendered = panel));
  render();
  const radius = Number(el.curveRadius.value);
  assert.ok(radius > 10);
  assert.equal(
    rendered.outlinePath,
    geometry.circularArcPath(geometry.starVertices(80, 150), radius),
  );
  assert.ok(rendered.outlinePath.includes('A'));
  assert.equal(el.curveRadiusNumber.value, el.curveRadius.value);
  assert.equal(el.holeSpacingNumber.value, el.holeSpacing.value);
});
