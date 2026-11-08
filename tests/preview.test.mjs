import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { computePanel, renderSVGToDOM } from '../src/lib/renderer.ts';
import { svg as svgFactory } from '../src/lib/svg.ts';
import { createLayoutSvg } from '../src/lib/layout.ts';
import { updateLayoutPreview } from '../src/lib/layout-preview.ts';
import { createExportSvg } from '../src/lib/export.ts';
import { findNesting } from '../src/lib/nesting.ts';
import { designKey } from '../src/lib/nesting-types.ts';
import { createFrameScheduler } from '../src/lib/frame-scheduler.ts';
globalThis.window = new JSDOM('').window;
globalThis.document = window.document;
const config = {
  nSides: 5,
  sideLen: 30,
  seamOffset: 5,
  stitchCount: 8,
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
const base = {
  rows: 2,
  cols: 3,
  hSpace: 4,
  vSpace: 5,
  invertOdd: false,
  nestingVerticalOffset: 0,
  dotDiameter: 1,
  padding: 10,
  showGrid: true,
};
const xml = (svg) => new window.XMLSerializer().serializeToString(svg);

test('incremental manual updates match fresh SVGs and scaled exports for every shape, curve and hole mode', () => {
  for (const [nSides, hexType] of [
    [3, 'regular'],
    [4, 'regular'],
    [5, 'regular'],
    [6, 'regular'],
    [6, 'truncated'],
    [10, 'regular'],
  ])
    for (const curvedEdges of [false, true])
      for (const stitchCount of [0, 8]) {
        const panel = computePanel({ ...config, nSides, hexType, curvedEdges, stitchCount });
        let svg = updateLayoutPreview(panel, base);
        const original = svg,
          firstCircle = svg.querySelector('circle'),
          firstPath = svg.querySelector('path');
        for (const changes of [
          { hSpace: -4, vSpace: 1 },
          { padding: 0 },
          { invertOdd: true, nestingVerticalOffset: -4 },
          { showGrid: false, invertOdd: true, nestingVerticalOffset: 4 },
          { rows: 3, cols: 2, showGrid: true },
          { invertOdd: false, nestingVerticalOffset: -3 },
          { padding: 20 },
        ]) {
          const opts = { ...base, ...changes };
          svg = updateLayoutPreview(panel, opts, svg);
          assert.equal(svg, original);
          assert.equal(svg.querySelector('circle'), firstCircle);
          assert.equal(svg.querySelector('path'), firstPath);
          const fresh = createLayoutSvg(panel, opts);
          assert.equal(
            xml(svg),
            xml(fresh),
            JSON.stringify({ nSides, hexType, curvedEdges, stitchCount, changes }),
          );
          for (const scale of [75, 100, 125])
            assert.equal(xml(createExportSvg(svg, scale)), xml(createExportSvg(fresh, scale)));
        }
      }
});

test('count, geometry, dot size and manual/optimized transitions rebuild safely', () => {
  const panel = computePanel(config);
  let svg = updateLayoutPreview(panel, base);
  for (const [nextPanel, opts] of [
    [panel, { ...base, rows: 3 }],
    [panel, { ...base, dotDiameter: 1.5 }],
    [computePanel({ ...config, sideLen: 50 }), base],
    [
      panel,
      { ...base, optimized: findNesting(panel, 6, 1, true, designKey(config, 1, 6), 10, 1, 3) },
    ],
    [panel, base],
  ]) {
    const next = updateLayoutPreview(nextPanel, opts, svg);
    assert.notEqual(next, svg);
    assert.equal(xml(next), xml(createLayoutSvg(nextPanel, opts)));
    svg = next;
  }
});

test('optimized updates preserve drawings while positions, padding and grid change', () => {
  const panel = computePanel(config);
  const plan = findNesting(panel, 6, 1, true, designKey(config, 1, 6), 10, 1, 3);
  let opts = { ...base, optimized: plan },
    svg = updateLayoutPreview(panel, opts);
  const root = svg,
    path = svg.querySelector('path'),
    circle = svg.querySelector('circle');
  for (const changes of [
    { padding: 0 },
    { showGrid: false },
    { padding: 25, showGrid: true },
    {
      optimized: {
        ...plan,
        placements: plan.placements.map((at) => ({ ...at, x: at.x + 3, y: at.y - 7 })),
      },
    },
  ]) {
    opts = { ...opts, ...changes };
    svg = updateLayoutPreview(panel, opts, svg);
    assert.equal(svg, root);
    assert.equal(svg.querySelector('path'), path);
    assert.equal(svg.querySelector('circle'), circle);
    assert.equal(xml(svg), xml(createLayoutSvg(panel, opts)));
    assert.equal(
      xml(createExportSvg(svg, 125)),
      xml(createExportSvg(createLayoutSvg(panel, opts), 125)),
    );
  }
});

test('frame scheduler coalesces latest state, flushes before reads, cancels and permits reentrant work', () => {
  let id = 0,
    value = 0;
  const callbacks = new Map(),
    seen = [];
  const scheduler = createFrameScheduler(
    () => seen.push(value),
    (callback) => {
      callbacks.set(++id, callback);
      return id;
    },
    (handle) => callbacks.delete(handle),
  );
  const tick = () => {
    const queued = [...callbacks.values()];
    callbacks.clear();
    for (const callback of queued) callback(0);
  };
  for (let i = 0; i < 24; i++) {
    value = i;
    scheduler.schedule();
  }
  assert.equal(callbacks.size, 1);
  assert.deepEqual(seen, []);
  scheduler.flush();
  assert.deepEqual(seen, [23]);
  assert.equal(callbacks.size, 0);
  scheduler.flush();
  tick();
  assert.deepEqual(seen, [23]);
  value = 42;
  scheduler.schedule();
  scheduler.cancel();
  tick();
  assert.deepEqual(seen, [23]);
  scheduler.schedule();
  tick();
  assert.deepEqual(seen, [23, 42]);
  let count = 0;
  const reentrant = createFrameScheduler(
    () => {
      if (++count === 1) reentrant.schedule();
    },
    (callback) => {
      callbacks.set(++id, callback);
      return id;
    },
    (handle) => callbacks.delete(handle),
  );
  reentrant.schedule();
  tick();
  assert.equal(count, 1);
  assert.equal(callbacks.size, 1);
  reentrant.flush();
  assert.equal(count, 2);
  assert.equal(callbacks.size, 0);
});

test('single-panel grid updates preserve marks and match fresh scaled exports', () => {
  const panel = computePanel(config);
  const el = { svgHost: document.createElement('div'), showGrid: document.createElement('input') };
  el.showGrid.type = 'checkbox';
  el.showGrid.checked = true;
  renderSVGToDOM(panel, 1, el);
  const original = el.svgHost.querySelector('svg'),
    circle = original.querySelector('circle'),
    path = original.querySelector('path');
  for (const showGrid of [false, true, false, true]) {
    el.showGrid.checked = showGrid;
    renderSVGToDOM(panel, 1, el);
    const current = el.svgHost.querySelector('svg');
    assert.equal(current, original);
    assert.equal(current.querySelector('circle'), circle);
    assert.equal(current.querySelector('path'), path);
    for (const scale of [75, 100, 125])
      assert.equal(
        xml(createExportSvg(current, scale)),
        xml(createExportSvg(svgFactory.createSvg(panel, { dotDiameter: 1, showGrid }), scale)),
      );
  }
});
