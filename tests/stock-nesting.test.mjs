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
import { adoptPlan, latticePlacements, readEditableLayout } from '../src/lib/lattice.ts';
import {
  applyEditableLayout,
  editablePlan,
  initializeEditableLayout,
} from '../src/lib/editable-layout.ts';
import { createLayoutSvg } from '../src/lib/layout.ts';
import { showNestingOverlay, clearNestingOverlay } from '../src/lib/nesting-overlay.ts';
import { createExportSvg } from '../src/lib/export.ts';

test('shared advanced settings migrate conflicting older values; v1 files remain valid and v2 is explicit', () => {
  const { el, layout } = fresh();
  const original = state.collect(el, layout);
  // Frozen from merged main 72d4cd0; never sync this compatibility fixture.
  const oldSchema = JSON.parse(
    readFileSync(new URL('./fixtures/settings-schema-v1.json', import.meta.url), 'utf8'),
  );
  const schema = JSON.parse(
    readFileSync(new URL('../schema/settings.schema.json', import.meta.url), 'utf8'),
  );
  const validateOld = new Ajv2020({ strict: false }).compile(oldSchema);
  const validate = new Ajv2020({ strict: false }).compile(schema);
  assert.equal(original.version, 1);
  assert.ok(validateOld(original));
  assert.ok(validate(original));
  const model = {
    count: 7,
    columns: 4,
    pitchX: 52.125,
    pitchY: 48.875,
    pattern: 4,
    angle: 90,
    rotateAlternates: true,
    rotations: 'quarter',
    gap: 0.5,
    stock: { mode: 'fit', width: 250, height: 175 },
  };
  for (const [mode, gap] of [
    ['free', 0],
    ['fit', 1],
    ['capacity', 2],
  ]) {
    applyEditableLayout(layout, model);
    layout.nestingMode.value = mode;
    layout.nestingRotation.value = 'quarter';
    layout.nestingStockWidth.value = '210.5';
    layout.nestingStockHeight.value = '297.25';
    layout.nestingGap.value = String(gap);
    el.exportScale.value = '125';
    const saved = state.collect(el, layout);
    assert.equal(saved.version, 2);
    assert.deepEqual(saved.layout.editable, model);
    assert.deepEqual(saved.layout.nesting, {
      mode,
      rotations: 'quarter',
      width: model.stock.width,
      height: model.stock.height,
      gap: model.gap,
    });
    assert.ok(validate(saved), JSON.stringify(validate.errors));
    assert.equal(validateOld(saved), false);
    state.apply(el, original, layout);
    state.apply(el, JSON.parse(JSON.stringify(saved)), layout);
    assert.deepEqual(state.collect(el, layout), saved);
    assert.equal(layout.nestingGap.value, String(model.gap));
    assert.equal(document.getElementById('layoutGap'), null);
    const old = {
      ...saved,
      layout: {
        ...saved.layout,
        nesting: { mode, gap, rotations: 'half', width: 210.5, height: 297.25 },
      },
    };
    state.apply(el, old, layout);
    assert.deepEqual(state.collect(el, layout), saved);
    assert.match(
      document.getElementById('layoutImportNotice').textContent,
      /older search settings differed/,
    );
    // Preview exports made before the version bump remain readable too.
    state.apply(el, { ...saved, version: 1 }, layout);
    assert.deepEqual(state.collect(el, layout), saved);
    const before = state.collect(el, layout);
    for (const badGap of [-1, 21, '2', null]) {
      assert.throws(() =>
        state.apply(
          el,
          {
            ...saved,
            side: 60,
            layout: { ...saved.layout, nesting: { ...saved.layout.nesting, gap: badGap } },
          },
          layout,
        ),
      );
      assert.deepEqual(state.collect(el, layout), before);
    }
  }
  state.apply(el, original, layout);
  layout.nestingGap.value = '0';
  const unapplied = state.collect(el, layout);
  assert.equal(unapplied.version, 2);
  assert.equal(unapplied.layout.editable, undefined);
  assert.equal(unapplied.layout.nesting.gap, 0);
  state.apply(el, original, layout);
  state.apply(el, unapplied, layout);
  assert.deepEqual(state.collect(el, layout), unapplied);
  state.apply(el, original, layout);
  assert.deepEqual(state.collect(el, layout), original);
});

test('candidate overlays leave the exportable SVG untouched and restore the comparison canvas', () => {
  fresh();
  const panel = computePanel(config);
  const plan = findNesting({
    panel,
    count: 7,
    gap: 1,
    rotations: 'half',
    source: 'overlay',
    padding: 10,
    dot: 1,
    currentCols: 3,
  });
  const host = document.createElement('div'),
    wrap = document.createElement('div');
  wrap.className = 'svg-wrap';
  wrap.style.width = '123px';
  const svg = createLayoutSvg(panel, {
    rows: 2,
    cols: 2,
    hSpace: 5,
    vSpace: 5,
    dotDiameter: 1,
    padding: 10,
    showGrid: true,
  });
  wrap.appendChild(svg);
  host.appendChild(wrap);
  const before = svg.outerHTML,
    exported = createExportSvg(svg).outerHTML;
  showNestingOverlay(host, panel, plan, 1, 10);
  const image = wrap.querySelector('img[data-nesting-preview]');
  assert.ok(image);
  assert.ok(decodeURIComponent(image.src).includes('#16a34a'));
  assert.equal(svg.outerHTML, before);
  assert.equal(createExportSvg(svg).outerHTML, exported);
  assert.equal(host.querySelectorAll('svg').length, 1);
  clearNestingOverlay(host);
  assert.equal(wrap.querySelector('img'), null);
  assert.equal(wrap.style.width, '123px');
  assert.equal(wrap.style.height, '');
  assert.equal(svg.outerHTML, before);
  const empty = document.createElement('div');
  empty.innerHTML = '<p>Current layout needs adjustment</p>';
  showNestingOverlay(empty, panel, plan, 1, 10);
  assert.ok(empty.querySelector('img'));
  clearNestingOverlay(empty);
  assert.equal(empty.innerHTML, '<p>Current layout needs adjustment</p>');
});

test('adopted optimizer patterns reproduce exact placements and SVGs across shapes and policies', () => {
  fresh();
  for (const [nSides, hexType] of [
    [3, 'regular'],
    [4, 'regular'],
    [5, 'regular'],
    [6, 'regular'],
    [6, 'truncated'],
    [10, 'regular'],
  ])
    for (const curvedEdges of [false, true])
      for (const rotations of ['none', 'half', 'quarter']) {
        const c = { ...config, nSides, hexType, curvedEdges },
          panel = computePanel(c);
        const plan = {
          ...findNesting({
            panel,
            count: 7,
            gap: 1,
            rotations,
            source: designKey(c, 1, 7),
            padding: 10,
            dot: 1,
            currentCols: 3,
          }),
          rotations,
        };
        const model = adoptPlan(plan),
          adopted = editablePlan(model, c, 1);
        assert.deepEqual(adopted.placements, plan.placements);
        const opts = {
          rows: 3,
          cols: 3,
          hSpace: 0,
          vSpace: 1,
          invertOdd: false,
          nestingVerticalOffset: 0,
          padding: 10,
          dotDiameter: 1,
          showGrid: true,
        };
        assert.equal(
          createLayoutSvg(panel, { ...opts, optimized: adopted }).outerHTML,
          createLayoutSvg(panel, { ...opts, optimized: plan }).outerHTML,
        );
        const wrong = structuredClone(plan);
        wrong.lattice.pitchX += 1;
        if (plan.lattice.columns > 1 && plan.lattice.columns <= 7)
          assert.throws(() => adoptPlan(wrong), /does not match/);
      }
});

test('pattern edits retain placement settings across design changes and guard unsafe exports', () => {
  const { el, layout, page } = fresh(),
    panel = computePanel(config);
  const model = adoptPlan({
    ...findCapacity({
      panel,
      gap: 1,
      rotations: 'none',
      source: designKey(config, 1, 9),
      padding: 10,
      dot: 1,
      stock: { width: 120, height: 85 },
    }),
    rotations: 'none',
  });
  applyEditableLayout(layout, model);
  const original = state.collect(el, layout);
  assert.deepEqual(original.layout.editable, model);
  assert.equal(original.layout.optimized, undefined);
  state.apply(el, JSON.parse(JSON.stringify(original)), layout);
  assert.deepEqual(layout.editable.current, model);
  assert.equal(document.getElementById('layoutCount').value, '6');
  const render = (c) =>
    renderLayout(computePanel(c), 1, page, layout, { lastLayoutWpx: 0, lastLayoutHpx: 0 }, c);
  render({ ...config, sideLen: 25 });
  assert.deepEqual(layout.editable.current, model);
  assert.equal(page.svgHost.querySelectorAll('path').length, 6);
  render({ ...config, sideLen: 40 });
  assert.equal(page.svgHost.querySelector('svg'), null);
  assert.equal(document.getElementById('downloadPageSvg').disabled, true);
  assert.deepEqual(layout.editable.current, model);
  render(config);
  assert.equal(page.svgHost.querySelectorAll('path').length, 6);
  const schema = JSON.parse(
    readFileSync(new URL('../schema/settings.schema.json', import.meta.url), 'utf8'),
  );
  assert.ok(new Ajv2020({ strict: false }).validate(schema, original));
  for (const bad of [
    { ...model, count: 145 },
    { ...model, columns: 0 },
    { ...model, pitchX: NaN },
    { ...model, angle: 45 },
    { ...model, rotateAlternates: 'true' },
  ]) {
    assert.throws(() => readEditableLayout(bad));
    assert.throws(() =>
      state.apply(
        el,
        { ...original, side: 60, layout: { ...original.layout, editable: bad } },
        layout,
      ),
    );
    assert.deepEqual(state.collect(el, layout), original);
  }
  for (const pattern of [0, 1, 2, 3, 4])
    for (const angle of [0, 90, 180, 270]) {
      const placements = latticePlacements({ ...model, pattern, angle, columns: 3 }, 7);
      assert.equal(placements.length, 7);
      assert.deepEqual(placements[0], { x: 0, y: 0, angle });
      assert.ok(placements.every((at) => [0, 90, 180, 270].includes(at.angle)));
    }
});

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
  const plan = findNesting({
    panel,
    count: 6,
    gap: 1,
    rotations: 'none',
    source: 'fit',
    padding: 10,
    dot: 1,
    currentCols: 3,
    stock,
  });
  verify(panel, plan, stock, [0]);
  assert.equal(plan.placements.length, 6);
  assert.ok(measurePlaced(panel, plan.placements, 1, 10).height < 210);
  assert.throws(
    () =>
      findNesting({
        panel,
        count: 6,
        gap: 1,
        rotations: 'half',
        source: 'fit',
        padding: 10,
        dot: 1,
        currentCols: 3,
        stock: { width: 55, height: 55 },
      }),
    /No arrangement found/,
  );
  const triangle = computePanel({ ...config, nSides: 3 });
  assert.throws(
    () =>
      findNesting({
        panel: triangle,
        count: 1,
        gap: 1,
        rotations: 'none',
        source: 'fit',
        padding: 10,
        dot: 1,
        currentCols: 1,
        stock: { width: 49 },
      }),
    /No arrangement/,
  );
  const rotated = findNesting({
    panel: triangle,
    count: 1,
    gap: 1,
    rotations: 'quarter',
    source: 'fit',
    padding: 10,
    dot: 1,
    currentCols: 1,
    stock: { width: 49 },
  });
  verify(triangle, rotated, { width: 49 }, [90, 270]);
});

test('capacity is deterministic, obeys full-outline clearance and caps results at 144', () => {
  const panel = computePanel(config),
    stock = { width: 120, height: 85 };
  const plan = findCapacity({
    panel,
    gap: 1,
    rotations: 'none',
    source: 'capacity',
    padding: 10,
    dot: 1,
    stock,
  });
  assert.equal(plan.placements.length, 6);
  verify(panel, plan, stock, [0]);
  const strip = findCapacity({
    panel,
    gap: 1,
    rotations: 'none',
    source: 'strip',
    padding: 10,
    dot: 1,
    stock: { width: 6000, height: 55 },
  });
  const adoptedStrip = adoptPlan({ ...strip, rotations: 'none' });
  assert.equal(adoptedStrip.count, 144);
  assert.equal(adoptedStrip.columns, 144);
  assert.deepEqual(latticePlacements(adoptedStrip, 144), strip.placements);
  assert.deepEqual(
    plan,
    findCapacity({
      panel,
      gap: 1,
      rotations: 'none',
      source: 'capacity',
      padding: 10,
      dot: 1,
      stock,
    }),
  );
  assert.equal(
    findCapacity({
      panel,
      gap: 1,
      rotations: 'half',
      source: 'cap',
      padding: 10,
      dot: 1,
      stock: { width: 1000, height: 1000 },
    }).placements.length,
    144,
  );
  assert.throws(
    () =>
      findCapacity({
        panel,
        gap: 1,
        rotations: 'half',
        source: 'cap',
        padding: 10,
        dot: 1,
        stock: { width: 120 },
      }),
    /requires width and height/,
  );
  assert.throws(
    () =>
      findCapacity({
        panel,
        gap: 1,
        rotations: 'half',
        source: 'cap',
        padding: 10,
        dot: 1,
        stock: { width: 10, height: 10 },
      }),
    /No arrangement/,
  );
  for (const nSides of [3, 5, 6, 10]) {
    const shaped = computePanel({ ...config, nSides, curvedEdges: true });
    const found = findCapacity({
      panel: shaped,
      gap: 2,
      rotations: 'quarter',
      source: 'cap',
      padding: 10,
      dot: 1,
      stock: { width: 150, height: 130 },
    });
    verify(shaped, found, { width: 150, height: 130 }, [0, 90, 180, 270]);
  }
});

test('stock fit includes scaled drawing allowances and padding, and capacity utilization uses actual count', () => {
  const panel = computePanel(config),
    stock = { mode: 'capacity', width: 120, height: 85 };
  const plan = {
    ...findCapacity({
      panel,
      gap: 1,
      rotations: 'none',
      source: designKey(config, 1, 9),
      padding: 10,
      dot: 1,
      stock,
    }),
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
  const rotated = findNesting({
    panel,
    count: 4,
    gap: 1,
    rotations: 'quarter',
    source: designKey(config, 1, 4),
    padding: 10,
    dot: 1,
    currentCols: 2,
  });
  rotated.placements[0].angle = 90;
  assert.equal(validPlan({ ...rotated, rotations: 'none' }, panel, config, 1, 4), false);
});

test('stock settings and incomplete search preferences round trip; malformed imports are atomic', () => {
  const { el, layout } = fresh();
  const original = state.collect(el, layout);
  const panel = computePanel(config),
    stock = { mode: 'capacity', width: 120, height: 85 };
  const plan = {
    ...findCapacity({
      panel,
      gap: 1,
      rotations: 'none',
      source: designKey(config, 1, 9),
      padding: 10,
      dot: 1,
      stock,
    }),
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
  assert.deepEqual(collected.layout.nesting, { ...saved.layout.nesting, gap: 1 });
  state.apply(
    el,
    { ...saved, layout: { ...saved.layout, nesting: { mode: 'fit', rotations: 'half' } } },
    layout,
  );
  assert.equal(layout.nestingStockWidth.value, '120');
  assert.equal(layout.nestingStockHeight.value, '85');
  assert.equal(layout.nestingRotation.value, 'none');
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
    ...findNesting({
      panel,
      count: 9,
      gap: 1,
      rotations: 'none',
      source: designKey(config, 1, 9),
      padding: 10,
      dot: 1,
      currentCols: 3,
      stock: {
        width: 120,
        height: 120,
      },
    }),
    stock: { mode: 'fit', width: 120, height: 120 },
    rotations: 'none',
  };
  const plan = layout.nesting.active;
  const render = () =>
    renderLayout(panel, 1, page, layout, { lastLayoutWpx: 0, lastLayoutHpx: 0 }, config);
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

test('editing legacy plan constraints retains exact positions while unsafe exports are blocked', () => {
  for (const capacity of [false, true]) {
    const { layout, page } = fresh(),
      panel = computePanel(config),
      source = designKey(config, 1, 9);
    const stock = { mode: 'capacity', width: 120, height: 85 };
    layout.nesting.active = capacity
      ? {
          ...findCapacity({ panel, gap: 1, rotations: 'none', source, padding: 10, dot: 1, stock }),
          stock,
          rotations: 'none',
        }
      : findNesting({
          panel,
          count: 9,
          gap: 1,
          rotations: 'half',
          source,
          padding: 10,
          dot: 1,
          currentCols: 3,
        });
    const original = state.collect(createMainElements(), layout);
    state.apply(createMainElements(), original, layout);
    const placements = structuredClone(layout.nesting.active.placements);
    const render = () =>
      renderLayout(panel, 1, page, layout, { lastLayoutWpx: 0, lastLayoutHpx: 0 }, config);
    initializeEditableLayout(layout, () => ({ panel, dot: 1 }), render);
    const gap = document.getElementById('nestingGap');
    gap.value = '20';
    gap.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.deepEqual(layout.nesting.active.placements, placements);
    assert.equal(page.downloadSvg.disabled, true);
    gap.value = '1';
    gap.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.deepEqual(layout.nesting.active.placements, placements);
    assert.equal(page.downloadSvg.disabled, false);
  }
});
