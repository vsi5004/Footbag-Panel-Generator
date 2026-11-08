import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { computePanel, renderLayout } from '../src/lib/renderer.ts';
import { findNesting } from '../src/lib/nesting.ts';
import {
  flattenOutline,
  polygonsTooClose,
  checkPlacements,
  isSimple,
} from '../src/lib/nesting-geometry.ts';
import {
  designKey,
  measurePlaced,
  transform,
  CLEARANCE_ALLOWANCE,
} from '../src/lib/nesting-types.ts';
import { validPlan } from '../src/lib/nesting-validation.ts';
import { createLayoutSvg, manualPlacements } from '../src/lib/layout.ts';
import { createExportSvg } from '../src/lib/export.ts';
import { state } from '../src/lib/state.ts';
import { createMainElements, getLayoutElements, createPageElements } from '../src/lib/dom.ts';
import { getEdgeMetrics } from '../src/lib/edge-metrics.ts';
import { geometry } from '../src/lib/geometry.ts';

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
const opts = {
  rows: 3,
  cols: 3,
  hSpace: 5,
  vSpace: 5,
  invertOdd: false,
  nestingVerticalOffset: 0,
  dotDiameter: 1,
  padding: 10,
  showGrid: false,
};
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function fresh() {
  globalThis.window = new JSDOM(html).window;
  globalThis.document = window.document;
  return { el: createMainElements(), layout: getLayoutElements(), page: createPageElements() };
}
test('edge cache preserves exact samples and invalidates every sampling input', () => {
  for (const radius of [0, 15, 30, 60])
    for (const count of [40, 120, 160]) {
      const a = { x: -15, y: 0 },
        b = { x: 15, y: 0 };
      const m = getEdgeMetrics(a, b, radius, count);
      assert.deepEqual(m.samples, geometry.approxArcEdgeSamples(a, b, radius, count));
      assert.equal(m.distances.length, count + 1);
      assert.equal(m.length, m.distances.at(-1));
    }
  for (let i = 1; i < 200; i++) getEdgeMetrics({ x: 0, y: 0 }, { x: i, y: 1 }, i, 40);
  assert.deepEqual(
    getEdgeMetrics({ x: 0, y: 0 }, { x: 30, y: 0 }, 60, 160).samples,
    geometry.approxArcEdgeSamples({ x: 0, y: 0 }, { x: 30, y: 0 }, 60, 160),
  );
});
test('collision checks cover separated, touching, crossing, containment and concave outlines', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  const moved = (x) => square.map((p) => ({ x: p.x + x, y: p.y }));
  assert.equal(polygonsTooClose(square, moved(12), 1), false);
  assert.equal(polygonsTooClose(square, moved(11), 1), true);
  assert.equal(polygonsTooClose(square, moved(10), 0), true);
  assert.equal(polygonsTooClose(square, moved(9), 0), true);
  const inner = square.map((p) => ({ x: p.x / 2 + 2, y: p.y / 2 + 2 }));
  assert.equal(polygonsTooClose(square, inner, 0), true);
  const concave = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 3 },
    { x: 3, y: 3 },
    { x: 3, y: 10 },
    { x: 0, y: 10 },
  ];
  const inNotch = square.map((p) => ({ x: p.x / 5 + 6, y: p.y / 5 + 6 }));
  assert.equal(polygonsTooClose(concave, inNotch, 1), false);
  assert.equal(
    isSimple([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 10, y: 0 },
    ]),
    false,
  );
});
test('arc flattening follows rounded SVG radii and bounds chord error', () => {
  const points = flattenOutline('M -10 0 A 10 10 0 0 1 10 0 L -10 0 Z', 0.02);
  assert.ok(points.length > 20);
  for (const p of points) assert.ok(Math.abs(Math.hypot(p.x, p.y) - 10) < 1e-9);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    assert.ok(10 - Math.hypot((a.x + b.x) / 2, (a.y + b.y) / 2) <= 0.020001);
  }
  assert.ok(flattenOutline('M -10.001 0 A 10 10 0 0 1 10.001 0 L -10.001 0 Z').length > 20);
});
test('nesting is deterministic, preserves count and safely packs all shape variants and curves', () => {
  for (const [nSides, hexType] of [
    [3, 'regular'],
    [4, 'regular'],
    [5, 'regular'],
    [6, 'regular'],
    [6, 'truncated'],
    [10, 'regular'],
  ])
    for (const curvedEdges of [false, true]) {
      const c = { ...config, nSides, hexType, curvedEdges },
        panel = computePanel(c),
        source = designKey(c, 1, 6);
      const plan = findNesting(panel, 6, 1, true, source, 10, 1, 3);
      assert.equal(plan.placements.length, 6);
      assert.ok(validPlan(plan, panel, c, 1, 6));
      // Independently re-flatten 10x more finely and check every pair without the search allowance.
      assert.ok(checkPlacements(flattenOutline(panel.outlinePath, 0.002), plan.placements, 1.001));
      assert.deepEqual(plan, findNesting(panel, 6, 1, true, source, 10, 1, 3));
      assert.equal(validPlan(plan, panel, { ...c, sideLen: 31 }, 1, 6), false);
      assert.equal(validPlan(plan, panel, c, 1, 9), false);
    }
});
test('optimized SVG retains original paths/holes and scaled dimensions and bounds contain all marks', () => {
  fresh();
  const panel = computePanel(config),
    plan = findNesting(panel, 9, 1, true, designKey(config, 1, 9), 10, 1, 3);
  const svg = createLayoutSvg(panel, { ...opts, optimized: plan }),
    size = measurePlaced(panel, plan.placements, 1, 10);
  assert.equal(svg.querySelectorAll('path').length, 9);
  assert.equal(svg.querySelectorAll('circle').length, panel.stitches.length * 9);
  for (const path of svg.querySelectorAll('path'))
    assert.equal(path.getAttribute('d'), panel.outlinePath);
  assert.equal(svg.querySelectorAll('use').length, 0);
  for (const at of plan.placements)
    for (const p of panel.stitches) {
      const q = transform(p, at);
      assert.ok(q.x >= size.minX + 0.5 && q.x <= size.minX + size.width - 0.5);
      assert.ok(q.y >= size.minY + 0.5 && q.y <= size.minY + size.height - 0.5);
    }
  for (const scale of [75, 100, 125]) {
    const exported = createExportSvg(svg, scale);
    assert.ok(
      Math.abs(parseFloat(exported.getAttribute('width')) - (size.width * scale) / 100) < 1e-9,
    );
    assert.equal(exported.getAttribute('viewBox'), svg.getAttribute('viewBox'));
  }
});
test('manual placement transforms match the existing SVG, including flipped odd columns', () => {
  fresh();
  const panel = computePanel(config),
    options = { ...opts, invertOdd: true, nestingVerticalOffset: -4 };
  const list = manualPlacements(panel, options);
  const svg = createLayoutSvg(panel, options);
  assert.equal(list.length, 9);
  const groups = [...svg.children];
  for (let i = 0; i < groups.length; i++) {
    const outer = groups[i].getAttribute('transform').match(/translate\(([-\d.]+) ([-\d.]+)\)/);
    const inner = groups[i].firstElementChild.getAttribute('transform');
    const at = list[i];
    assert.ok(Math.abs(at.x - Number(outer[1])) < 0.00051);
    const flip = inner ? Number(inner.match(/matrix\(1 0 0 -1 0 ([-\d.]+)\)/)[1]) : 0;
    assert.ok(Math.abs(at.y - Number(outer[2]) - flip) < 0.0011);
  }
});
test('optimized settings validate, round trip, and older files clear active arrangements', () => {
  const { el, layout, page } = fresh();
  layout.pageEl = page;
  const c = config,
    panel = computePanel(c),
    plan = findNesting(panel, 9, 1, false, designKey(c, 1, 9), 10, 1, 3);
  layout.nesting.active = plan;
  const saved = state.collect(el, layout);
  const schema = JSON.parse(
    readFileSync(new URL('../schema/settings.schema.json', import.meta.url), 'utf8'),
  );
  assert.equal(new Ajv2020({ strict: false }).validate(schema, saved), true);
  state.apply(el, JSON.parse(JSON.stringify(saved)), layout);
  assert.deepEqual(layout.nesting.active, plan);
  const before = state.collect(el, layout);
  for (const bad of [
    { ...plan, gap: -1 },
    { ...plan, version: 2 },
    { ...plan, placements: [{ x: NaN, y: 0, angle: 0 }] },
    { ...plan, placements: [] },
    { ...plan, placements: [{ x: 0, y: 0, angle: 45 }] },
    { ...plan, placements: Array(145).fill({ x: 0, y: 0, angle: 0 }) },
  ]) {
    assert.throws(() =>
      state.apply(el, { ...saved, side: 60, layout: { ...saved.layout, optimized: bad } }, layout),
    );
    assert.deepEqual(state.collect(el, layout), before);
  }
  delete saved.layout.optimized;
  state.apply(el, saved, layout);
  assert.equal(layout.nesting.active, undefined);
});
test('unsafe imported placements fall back to manual without exporting overlaps as optimized', () => {
  const { layout, page } = fresh();
  const panel = computePanel(config);
  layout.nesting.active = {
    version: 1,
    source: designKey(config, 1, 9),
    gap: 1,
    placements: Array(9).fill({ x: 0, y: 0, angle: 0 }),
  };
  renderLayout(
    panel,
    1,
    page,
    layout,
    { lastLayoutWpx: 0, lastLayoutHpx: 0, isFirstLayoutRender: true },
    config,
  );
  assert.equal(layout.nesting.active, undefined);
  assert.match(document.getElementById('nestingStatus').textContent, /Manual layout restored/);
  assert.equal(page.svgHost.querySelectorAll('path').length, 9);
});
test('maximum panel count and zero gap retain conservative collision clearance', () => {
  const c = { ...config, nSides: 4, stitchCount: 0 },
    panel = computePanel(c);
  const plan = findNesting(panel, 144, 0, false, designKey(c, 1, 144), 10, 1, 12);
  assert.equal(plan.placements.length, 144);
  assert.ok(
    checkPlacements(
      flattenOutline(panel.outlinePath),
      plan.placements,
      CLEARANCE_ALLOWANCE - 0.001,
    ),
  );
});

test('staggered hexagons improve on an already tight grid, not just excess manual spacing', () => {
  const c = { ...config, nSides: 6 },
    panel = computePanel(c);
  // Six rows/columns, zero spacing, 1 mm dot allowance.
  const gridWidth = 6 * (60 + 1) + 20;
  const gridHeight = 6 * (30 * Math.sqrt(3) + 1) + 20;
  const plan = findNesting(panel, 36, 1, false, designKey(c, 1, 36), 10, 1, 6);
  const size = measurePlaced(panel, plan.placements, 1, 10);
  assert.ok(size.width * size.height < 0.9 * gridWidth * gridHeight);
  assert.ok(checkPlacements(flattenOutline(panel.outlinePath, 0.002), plan.placements, 1.001));
});
