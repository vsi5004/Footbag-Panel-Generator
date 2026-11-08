import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { state } from '../src/lib/state.ts';
import { createMainElements, getLayoutElements, createPageElements } from '../src/lib/dom.ts';
import { setupImportSettings } from '../src/lib/events.ts';
import { ui } from '../src/lib/ui.ts';

function controls() {
  globalThis.window = new JSDOM(
    readFileSync(new URL('../index.html', import.meta.url), 'utf8'),
  ).window;
  globalThis.document = window.document;
  return {
    el: createMainElements(),
    layout: { ...getLayoutElements(), pageEl: createPageElements() },
  };
}

test('import values are not clamped by the previous design dynamic bounds', () => {
  const { el, layout } = controls();
  el.curveRadius.min = '40';
  el.holeSpacing.max = '2';
  el.cornerMargin.max = '2';
  el.holeBunching.max = '1';
  state.apply(
    el,
    {
      shape: 5,
      side: 30,
      curved: true,
      curveRadius: 20,
      stitches: 4,
      holeSpacing: 4,
      cornerMargin: 4,
      holeBunching: 1.5,
    },
    layout,
  );
  for (const [key, value] of Object.entries({
    curveRadius: '20',
    holeSpacing: '4',
    cornerMargin: '4',
    holeBunching: '1.5',
  })) {
    assert.equal(el[key].value, value, key);
    assert.equal(el[`${key}Number`].value, value, `${key} display`);
  }
});

test('hidden curvature settings are restored for later toggles', () => {
  const { el, layout } = controls();
  state.apply(el, { curved: false, curveRadius: 45 }, layout);
  assert.equal(el.curved.checked, false);
  assert.equal(el.curveRadius.value, '45');
  assert.equal(state.collect(el, layout).curveRadius, 45);
});

test('invalid settings fail before any control is mutated', () => {
  const { el, layout } = controls();
  el.exportScale.value = '125';
  const before = state.collect(el, layout);
  for (const data of [
    null,
    [],
    'wrong',
    123,
    {},
    { shape: 7 },
    { version: 2, side: 30 },
    { side: 40, seam: 'wrong' },
    { side: 40, curved: 'false' },
    { side: 40, layout: [] },
    { side: 40, layout: { rows: null } },
    { side: 40, hex: { type: 'unknown' } },
    { side: 40, holeSpacing: Infinity },
    { side: 40, holeBunching: {} },
  ]) {
    assert.throws(() => state.apply(el, data, layout), undefined, JSON.stringify(data));
    assert.deepEqual(state.collect(el, layout), before);
  }
});

test('legacy partial settings and zero numeric values remain supported', () => {
  const { el, layout } = controls();
  state.apply(
    el,
    { side: '40', seam: 0, holeBunching: 0, cornerMargin: 0, layout: { vSpace: 0 } },
    layout,
  );
  assert.equal(el.side.value, '40');
  assert.equal(el.seam.value, '0');
  assert.equal(el.holeBunching.value, '0');
  assert.equal(el.cornerMargin.value, '0');
  assert.equal(layout.pageVSpace.value, '0');
  assert.equal(el.exportScale.value, '100');
});

test('partial imports preserve omitted boolean settings', () => {
  const { el, layout } = controls();
  el.curved.checked = true;
  el.showHoles.checked = false;
  state.apply(el, { side: 40 }, layout);
  assert.equal(el.curved.checked, true);
  assert.equal(el.showHoles.checked, false);
});

test('the first render receives feasible values and synchronized displays', () => {
  const { el, layout } = controls();
  state.apply(
    el,
    {
      shape: 4,
      side: 80,
      curved: true,
      curveRadius: 10,
      stitches: 20,
      holeSpacing: 50,
      holeBunching: 30,
      cornerMargin: 99,
    },
    layout,
  );
  assert.ok(Math.abs(Number(el.curveRadius.value) - 40) < 1e-10);
  for (const key of ['curveRadius', 'holeSpacing', 'holeBunching', 'cornerMargin']) {
    assert.equal(el[key].value, el[`${key}Number`].value, key);
    assert.ok(Number(el[key].value) <= Number(el[key].max), key);
    assert.ok(Number(el[key].value) >= Number(el[key].min), key);
  }
});

test('file imports ignore stale reads, report read failures, and render only successful imports', () => {
  const { el, layout } = controls();
  const readers = [];
  const messages = [];
  globalThis.FileReader = class {
    readAsText() {
      readers.push(this);
    }
  };
  globalThis.alert = (message) => messages.push(message);
  let renders = 0;
  setupImportSettings(el, ui, () => renders++, layout);
  Object.defineProperty(el.importFile, 'files', { configurable: true, value: [{}] });
  const select = () => el.importFile.dispatchEvent(new window.Event('change'));
  select();
  select();
  readers[1].result = JSON.stringify({ side: 40, layout: { invert: true } });
  readers[1].onload();
  assert.equal(el.side.value, '40');
  assert.equal(layout.nestingOffsetRow.classList.contains('hidden'), false);
  assert.equal(renders, 1);
  readers[0].result = JSON.stringify({ side: 20 });
  readers[0].onload();
  assert.equal(el.side.value, '40');
  assert.equal(renders, 1);
  select();
  readers[2].onerror();
  assert.deepEqual(messages, ['Unable to read settings file.']);
  assert.equal(el.side.value, '40');
  assert.equal(renders, 1);
  select();
  readers[3].result = JSON.stringify({ side: 60, showHoles: 'false' });
  readers[3].onload();
  assert.deepEqual(messages, ['Unable to read settings file.', 'Invalid settings file.']);
  assert.equal(el.side.value, '40');
  assert.equal(renders, 1);
});
