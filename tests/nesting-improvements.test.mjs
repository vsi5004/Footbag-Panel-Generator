import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePanel } from '../src/lib/renderer.ts';
import { nestingConfig } from './nesting-cases.mjs';
import { panelExtents } from '../src/lib/panel-extents.ts';
import { minimumSafePitch } from '../src/lib/pitch-search.ts';
import { flattenOutline, checkPlacements } from '../src/lib/nesting-geometry.ts';
import { fillStock } from '../src/lib/stock-fill.ts';
import { findCapacity, findNesting } from '../src/lib/nesting.ts';
import { measurePlaced } from '../src/lib/nesting-types.ts';
import { latticePlacements, adoptPlan, readEditableLayout } from '../src/lib/lattice.ts';

test('rendered bounds ignore absent and inset holes, but include protruding circles and exact arcs', () => {
  const panel = computePanel({ ...nestingConfig, stitchCount: 0, curvedEdges: true });
  assert.deepEqual(panelExtents(panel, 0), panelExtents(panel, 10));
  const box = panelExtents(panel, 10);
  for (const p of flattenOutline(panel.outlinePath, 0.0001)) {
    assert.ok(p.x >= box.minX && p.x <= box.maxX && p.y >= box.minY && p.y <= box.maxY);
  }
  const square = {
    outlinePath: 'M 0 0 L 30 0 L 30 30 L 0 30 Z',
    stitches: [{ x: 15, y: 15 }],
    bounds: { viewMinX: -10, viewMinY: -10, width: 50, height: 50 },
  };
  assert.deepEqual(panelExtents(square, 1), panelExtents({ ...square, stitches: [] }, 0));
  const marked = panelExtents({ ...square, stitches: [{ x: 0, y: 0 }] }, 4);
  assert.equal(marked.minX, -2);
  assert.equal(marked.minY, -2);
  assert.equal(marked.maxX, 30.085);
});

test('pitch search finds a tighter disconnected safe interval for actual concave stars', () => {
  const panel = computePanel({ ...nestingConfig, nSides: 10, sideLen: 19.8, stitchCount: 0 });
  const outline = flattenOutline(panel.outlinePath);
  const safe = (pitchX) =>
    checkPlacements(
      outline,
      latticePlacements(
        { columns: 3, pitchX, pitchY: 62.68325, pattern: 4, angle: 0, rotateAlternates: true },
        9,
      ),
      0.245,
    );
  assert.ok(safe(19.4587));
  assert.equal(safe(21.9695), false);
  assert.ok(safe(23.8526));
  const pitch = minimumSafePitch(44, safe);
  assert.ok(pitch < 21 && safe(pitch));
  assert.ok(minimumSafePitch(44, safe, false) > 23);
});

test('gap fill uses mixed quarter turns, keeps existing panels, and respects actual extents', () => {
  const panel = {
    outlinePath: 'M 0 0 L 30 0 L 30 10 L 0 10 Z',
    stitches: [],
    bounds: { viewMinX: -10, viewMinY: -10, width: 50, height: 30 },
  };
  const initial = [0, 10.5, 21].map((y) => ({ x: 0.085, y: y + 0.085, angle: 0 }));
  const stock = { width: 50.17, height: 40.17 };
  const half = fillStock(panel, initial, 10, stock, 'half', 0.245, 4, 0);
  const quarter = fillStock(panel, initial, 10, stock, 'quarter', 0.245, 4, 0);
  assert.equal(half.length, 3);
  assert.ok(quarter.length > 3);
  assert.deepEqual(quarter.slice(0, 3), initial);
  assert.ok(quarter.some((p) => p.angle === 90 || p.angle === 270));
  assert.ok(checkPlacements(flattenOutline(panel.outlinePath, 0.002), quarter, 0.245));
  const size = measurePlaced(panel, quarter, 4, 0);
  assert.ok(size.width <= stock.width && size.height <= stock.height);
  const model = adoptPlan({
    version: 1,
    source: 'fill',
    gap: 0.2,
    rotations: 'quarter',
    placements: quarter,
  });
  assert.deepEqual(model.placements, quarter);
  assert.deepEqual(readEditableLayout(JSON.parse(JSON.stringify(model))), model);
  for (const bad of [
    { placements: quarter.slice(1) },
    { placements: [...quarter.slice(1), { x: NaN, y: 0, angle: 0 }] },
    { placements: [...quarter.slice(1), { x: 0, y: 0, angle: 45 }] },
  ])
    assert.throws(() => readEditableLayout({ ...model, ...bad }));
});

test('capacity and fixed-count searches both apply a mixed-orientation gap-filled plan', () => {
  const panel = {
    outlinePath: 'M 0 0 L 30 0 L 30 10 L 0 10 Z',
    stitches: [],
    bounds: { viewMinX: -10, viewMinY: -10, width: 50, height: 30 },
  };
  const request = {
    panel,
    gap: 0.2,
    padding: 0,
    dot: 0,
    rotations: 'quarter',
    source: 'mixed',
    stock: { width: 50.17, height: 41 },
  };
  const capacity = findCapacity(request);
  assert.ok(capacity.placements.length >= 5);
  const fit = findNesting({ ...request, count: 5, currentCols: 1 });
  assert.equal(fit.placements.length, 5);
  assert.ok(checkPlacements(flattenOutline(panel.outlinePath), fit.placements, 0.245));
  assert.equal(fit.lattice, undefined);
  assert.deepEqual(adoptPlan(fit).placements, fit.placements);
});
