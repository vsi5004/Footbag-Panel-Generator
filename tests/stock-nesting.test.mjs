import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import Ajv2020 from 'ajv/dist/2020.js';
import { computePanel, renderLayout, createMainRenderFunction } from '../src/lib/renderer.ts';
import { findNesting, findCapacity } from '../src/lib/nesting.ts';
import { measurePlaced, designKey } from '../src/lib/nesting-types.ts';
import { checkPlacements, flattenOutline } from '../src/lib/nesting-geometry.ts';
import { fitsStock, readStock, readNestingPreferences } from '../src/lib/stock-nesting.ts';
import { validPlan } from '../src/lib/nesting-validation.ts';
import { calculateMaterialUtilization } from '../src/lib/layout.ts';
import { createMainElements, getLayoutElements, createPageElements } from '../src/lib/dom.ts';
import { state } from '../src/lib/state.ts';

const config = {
  nSides: 4,
  sideLen: 30,
  seamOffset: 5,
  stitchCount: 0,
  curvedEdges: false,
  hexType: 'regular',
  hexLong: 30,
  hexRatio: 0.5,
  curveRadius: 60,
  holeSpacing: 3,
  holeBunching: 0,
  cornerMargin: 0,
  starRootOffset: -1.5,
  starRootAngle: 128,
  cornerStitchSpacing: false,
  cornerStitchDistance: 3,
};
function fresh() {
  globalThis.window = new JSDOM(
    readFileSync(new URL('../index.html', import.meta.url), 'utf8'),
  ).window;
  globalThis.document = window.document;
  const layout = getLayoutElements(),
    page = createPageElements();
  layout.pageEl = page;
  return { el: createMainElements(), layout, page };
}
function verify(panel, plan, stock, rotations) {
  const size = measurePlaced(panel, plan.placements, 1, 10);
  assert.ok(size.width <= stock.width);
  if (stock.height !== undefined) assert.ok(size.height <= stock.height);
  assert.ok(
    checkPlacements(flattenOutline(panel.outlinePath, 0.002), plan.placements, plan.gap + 0.001),
  );
  assert.ok(plan.placements.every((p) => !p.flipY && rotations.includes(p.angle)));
}

test('stock fit honors width-only limits, both dimensions, and explicit rotations', () => {
  const panel = computePanel(config);
  const stock = { width: 55 };
  const plan = findNesting(panel, 6, 1, 'none', 'fit', 10, 1, 3, stock);
  verify(panel, plan, stock, [0]);
  assert.equal(plan.placements.length, 6);
  assert.ok(measurePlaced(panel, plan.placements, 1, 10).height < 210);
  assert.throws(
    () => findNesting(panel, 6, 1, 'half', 'fit', 10, 1, 3, { width: 55, height: 55 }),
    /No arrangement found/,
  );
  const triangle = computePanel({ ...config, nSides: 3 });
  assert.throws(
    () => findNesting(triangle, 1, 1, 'none', 'fit', 10, 1, 1, { width: 49 }),
    /No arrangement/,
  );
  const rotated = findNesting(triangle, 1, 1, 'quarter', 'fit', 10, 1, 1, { width: 49 });
  verify(triangle, rotated, { width: 49 }, [90, 270]);
});

test('capacity is deterministic, obeys full-outline clearance and caps results at 144', () => {
  const panel = computePanel(config),
    stock = { width: 120, height: 85 };
  const plan = findCapacity(panel, 1, 'none', 'capacity', 10, 1, stock);
  assert.equal(plan.placements.length, 6);
  verify(panel, plan, stock, [0]);
  assert.deepEqual(plan, findCapacity(panel, 1, 'none', 'capacity', 10, 1, stock));
  assert.equal(
    findCapacity(panel, 1, 'half', 'cap', 10, 1, { width: 1000, height: 1000 }).placements.length,
    144,
  );
  assert.throws(
    () => findCapacity(panel, 1, 'half', 'cap', 10, 1, { width: 120 }),
    /requires width and height/,
  );
  assert.throws(
    () => findCapacity(panel, 1, 'half', 'cap', 10, 1, { width: 10, height: 10 }),
    /No arrangement/,
  );
  for (const nSides of [3, 5, 6, 10]) {
    const shaped = computePanel({ ...config, nSides, curvedEdges: true });
    const found = findCapacity(shaped, 2, 'quarter', 'cap', 10, 1, { width: 150, height: 130 });
    verify(shaped, found, { width: 150, height: 130 }, [0, 90, 180, 270]);
  }
});

test('stock fit includes scaled drawing allowances and padding, and capacity utilization uses actual count', () => {
  const panel = computePanel(config),
    stock = { mode: 'capacity', width: 120, height: 85 };
  const plan = {
    ...findCapacity(panel, 1, 'none', designKey(config, 1, 9), 10, 1, stock),
    stock,
    rotations: 'none',
  };
  assert.ok(validPlan(plan, panel, config, 1, 9));
  assert.equal(
    validPlan({ ...plan, stock: { ...stock, mode: 'fit' } }, panel, config, 1, 9),
    false,
  );
  assert.equal(fitsStock(panel, plan, 1, 10, 100), true);
  assert.equal(fitsStock(panel, plan, 1, 10, 125), false);
  assert.equal(fitsStock(panel, plan, 1, 20, 100), false);
  assert.equal(fitsStock(panel, plan, 10, 10, 100), false);
  const size = measurePlaced(panel, plan.placements, 1, 10);
  assert.ok(
    Math.abs(
      calculateMaterialUtilization(
        panel,
        { rows: 3, cols: 3, padding: 10, dotDiameter: 1, optimized: plan },
        config,
      ) -
        (100 * 900 * 6) / (size.width * size.height),
    ) < 1e-8,
  );
  const rotated = findNesting(panel, 4, 1, 'quarter', designKey(config, 1, 4), 10, 1, 2);
  rotated.placements[0].angle = 90;
  assert.equal(validPlan({ ...rotated, rotations: 'none' }, panel, config, 1, 4), false);
});

test('stock settings and incomplete search preferences round trip; malformed imports are atomic', () => {
  const { el, layout } = fresh();
  const original = state.collect(el, layout);
  const panel = computePanel(config),
    stock = { mode: 'capacity', width: 120, height: 85 };
  const plan = {
    ...findCapacity(panel, 1, 'none', designKey(config, 1, 9), 10, 1, stock),
    stock,
    rotations: 'none',
  };
  const saved = {
    ...original,
    layout: {
      ...original.layout,
      optimized: plan,
      nesting: { mode: 'capacity', rotations: 'none', width: 120, height: 85 },
    },
  };
  state.apply(el, saved, layout);
  const collected = state.collect(el, layout);
  assert.deepEqual(collected.layout.optimized, plan);
  assert.deepEqual(collected.layout.nesting, saved.layout.nesting);
  state.apply(
    el,
    { ...saved, layout: { ...saved.layout, nesting: { mode: 'fit', rotations: 'half' } } },
    layout,
  );
  assert.equal(layout.nestingStockWidth.value, '');
  assert.equal(layout.nestingStockHeight.value, '');
  assert.deepEqual(state.collect(el, layout).layout.optimized, plan);
  state.apply(el, saved, layout);
  const validate = new Ajv2020({ strict: false }).compile(
    JSON.parse(readFileSync(new URL('../schema/settings.schema.json', import.meta.url), 'utf8')),
  );
  assert.ok(validate(collected), JSON.stringify(validate.errors));
  for (const bad of [
    { ...stock, height: undefined },
    { ...stock, width: 0 },
    { ...stock, height: Infinity },
    { ...stock, width: '120' },
    { ...stock, mode: 'free' },
  ]) {
    assert.throws(() => readStock(bad));
    assert.throws(() =>
      state.apply(
        el,
        { ...saved, side: 60, layout: { ...saved.layout, optimized: { ...plan, stock: bad } } },
        layout,
      ),
    );
    assert.deepEqual(state.collect(el, layout), collected);
  }
  for (const nesting of [
    { mode: 'bad', rotations: 'none' },
    { mode: 'fit', rotations: 'any' },
    { mode: 'fit', rotations: 'half', width: -1 },
  ]) {
    assert.throws(() => readNestingPreferences(nesting));
    assert.throws(() =>
      state.apply(el, { ...saved, layout: { ...saved.layout, nesting } }, layout),
    );
    assert.deepEqual(state.collect(el, layout), collected);
  }
  state.apply(
    el,
    {
      ...original,
      layout: { ...original.layout, nesting: { mode: 'capacity', rotations: 'quarter' } },
    },
    layout,
  );
  assert.ok(validate(state.collect(el, layout)));
  state.apply(el, original, layout);
  assert.equal(layout.nesting.active, undefined);
  assert.equal(layout.nestingMode.value, 'free');
  assert.equal(layout.nestingRotation.value, 'half');
  assert.equal(layout.nestingStockWidth.value, '');
});

test('outgrown imported stock plans block export and recover without discarding placements', () => {
  const { layout, page } = fresh(),
    panel = computePanel(config);
  layout.nesting.active = {
    ...findNesting(panel, 9, 1, 'none', designKey(config, 1, 9), 10, 1, 3, {
      width: 120,
      height: 120,
    }),
    stock: { mode: 'fit', width: 120, height: 120 },
    rotations: 'none',
  };
  const plan = layout.nesting.active;
  const render = () =>
    renderLayout(
      panel,
      1,
      page,
      layout,
      { lastLayoutWpx: 0, lastLayoutHpx: 0, isFirstLayoutRender: true },
      config,
    );
  layout.exportScale.value = '125';
  render();
  assert.equal(page.svgHost.querySelector('svg'), null);
  assert.equal(document.getElementById('downloadPageSvg').disabled, true);
  assert.equal(layout.nesting.active, plan);
  layout.exportScale.value = '100';
  render();
  assert.equal(page.svgHost.querySelectorAll('path').length, 9);
  assert.equal(document.getElementById('downloadPageSvg').disabled, false);
});

test('control-boundary geometry remains finite and fully enclosed across all shape families', () => {
  const { el } = fresh();
  let panel;
  const render = createMainRenderFunction(el, (value) => (panel = value));
  for (const shape of [3, 4, 5, 6, 10])
    for (const curved of [false, true])
      for (const extreme of [false, true]) {
        el.shape.value = String(shape);
        el.curved.checked = curved;
        for (const name of [
          'side',
          'seam',
          'stitches',
          'curveRadius',
          'hexLong',
          'hexRatio',
          'starRootAngle',
          'starRootOffset',
          'holeSpacing',
          'holeBunching',
          'cornerMargin',
        ]) {
          const input = el[name];
          input.value = extreme ? input.max : input.min;
        }
        el.hexType.value = shape === 6 && extreme ? 'truncated' : 'regular';
        render();
        assert.ok(!/NaN|Infinity/.test(panel.outlinePath));
        assert.ok(Object.values(panel.bounds).every(Number.isFinite));
        assert.ok(panel.bounds.width > 0 && panel.bounds.height > 0);
        const points = [...panel.stitches, ...flattenOutline(panel.outlinePath, 0.002)];
        for (const p of points) {
          assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
          assert.ok(
            p.x >= panel.bounds.viewMinX - 0.002 &&
              p.x <= panel.bounds.viewMinX + panel.bounds.width + 0.002,
          );
          assert.ok(
            p.y >= panel.bounds.viewMinY - 0.002 &&
              p.y <= panel.bounds.viewMinY + panel.bounds.height + 0.002,
          );
        }
      }
});
