import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
globalThis.window = new JSDOM(html).window;
globalThis.document = window.document;
const { state } = await import('../src/lib/state.ts');
const { ui } = await import('../src/lib/ui.ts');
const { resetPanelSettings } = await import('../src/lib/events.ts');
const { createMainElements, getLayoutElements, createPageElements } =
  await import('../src/lib/dom.ts');

function freshControls() {
  globalThis.window = new JSDOM(html).window;
  globalThis.document = window.document;
  return {
    el: createMainElements(),
    layout: { ...getLayoutElements(), pageEl: createPageElements() },
  };
}

test('11- and 12-row/column layouts survive settings round trips', () => {
  const { el, layout } = freshControls();
  for (const size of [1, 10, 11, 12]) {
    layout.pageRows.value = String(size);
    layout.pageCols.value = String(size);
    const saved = JSON.parse(JSON.stringify(state.collect(el, layout)));
    layout.pageRows.value = layout.pageCols.value = '3';
    state.apply(el, saved, layout);
    for (const field of ['pageRows', 'pageRowsNumber', 'pageCols', 'pageColsNumber']) {
      assert.equal(layout[field].value, String(size), field);
    }
    assert.equal(state.collect(el, layout).layout.rows, size);
    assert.equal(state.collect(el, layout).layout.cols, size);
  }
  state.apply(el, { layout: { rows: 50, cols: 0 } }, layout);
  assert.equal(layout.pageRows.value, '12');
  assert.equal(layout.pageCols.value, '1');
});

test('panel Reset restores all design controls and visibility to fresh-page defaults', () => {
  const { el, layout } = freshControls();
  const section = document.querySelector('[aria-label="Panel Settings"]');
  const controls = [...section.querySelectorAll('input, select'), el.showGrid];
  const defaults = controls.map((control) => ({
    control,
    value: control.value,
    checked: control.checked,
  }));
  const saved = state.collect(el, layout);
  el.exportScale.value = '125';
  el.zoom.value = '250';
  layout.pageRows.value = '12';
  for (const control of controls) {
    if (control.type === 'checkbox') control.checked = !control.defaultChecked;
    else if (control.tagName === 'SELECT') control.selectedIndex = control.options.length - 1;
    else control.value = control.max;
  }
  // Simulate a dynamic limit inherited from a much smaller previous design.
  el.holeSpacing.max = '2';
  ui.updateVisibility(el);
  let renders = 0;
  resetPanelSettings(el, ui, () => renders++);
  assert.equal(renders, 1);
  for (const { control, value, checked } of defaults) {
    assert.equal(control.value, value, control.id);
    assert.equal(control.checked, checked, control.id);
    if (control.type === 'range') {
      assert.equal(
        document.getElementById(`${control.id}Number`).value,
        value,
        `${control.id} display`,
      );
    }
  }
  const restored = state.collect(el, layout);
  delete saved.layout;
  delete restored.layout;
  delete saved.export;
  delete restored.export;
  assert.deepEqual(restored, saved);
  assert.equal(el.stitchesRow.classList.contains('hidden'), false);
  assert.equal(el.seamRow.classList.contains('hidden'), false);
  assert.equal(document.getElementById('advanced').classList.contains('hidden'), false);
  assert.equal(el.starRootAngleRow.classList.contains('hidden'), true);
  assert.equal(el.cornerStitchSpacingRow.classList.contains('hidden'), true);
  assert.equal(el.curveRadiusRow.classList.contains('hidden'), true);
  assert.equal(el.hexTypeRow.classList.contains('hidden'), true);
  assert.equal(el.exportScale.value, '125');
  assert.equal(el.zoom.value, '250');
  assert.equal(layout.pageRows.value, '12');
});

test('repeated Reset adds no listeners and preserves the original input bindings', () => {
  const { el } = freshControls();
  let registrations = 0;
  for (const control of document.querySelectorAll('input, select')) {
    const original = control.addEventListener.bind(control);
    control.addEventListener = (...args) => {
      registrations++;
      return original(...args);
    };
  }
  let changes = 0;
  ui.syncPair(el.side, el.sideNumber, () => changes++);
  const initialRegistrations = registrations;
  for (let i = 0; i < 10; i++) resetPanelSettings(el, ui, () => {});
  assert.equal(registrations, initialRegistrations);
  el.side.value = '35';
  el.side.dispatchEvent(new window.Event('input'));
  assert.equal(el.sideNumber.value, '35');
  assert.equal(changes, 1);
  el.sideNumber.value = '40';
  el.sideNumber.dispatchEvent(new window.Event('input'));
  assert.equal(el.side.value, '40');
  assert.equal(changes, 2);
});

test('layout reset follows declared defaults and preserves panel and export settings', async () => {
  const { resetLayoutSettings } = await import('../src/lib/events.ts');
  const { layoutControlPairs } = await import('../src/lib/controls.ts');
  const { el, layout } = freshControls();
  const before = state.collect(el, layout);
  // A future definition change must propagate through HTML defaults to Reset.
  layout.pageRows.defaultValue = '4';
  layout.pageInvert.defaultChecked = true;
  const pairs = layoutControlPairs(layout);
  for (const [range, display] of pairs) {
    range.value = range.max;
    display.value = range.max;
  }
  layout.pageInvert.checked = false;
  layout.pageEl.showGrid.checked = !layout.pageEl.showGrid.defaultChecked;
  let renders = 0;
  resetLayoutSettings(layout, () => renders++, null, 1);
  assert.equal(renders, 1);
  for (const [range, display] of pairs) {
    assert.equal(range.value, range.defaultValue, range.id);
    assert.equal(display.value, range.defaultValue, display.id);
  }
  assert.equal(layout.pageInvert.checked, true);
  assert.equal(layout.nestingOffsetRow.classList.contains('hidden'), false);
  assert.equal(layout.pageEl.showGrid.checked, layout.pageEl.showGrid.defaultChecked);
  const after = state.collect(el, layout);
  delete before.layout;
  delete after.layout;
  assert.deepEqual(after, before);
});
