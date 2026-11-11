import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compactPlacements } from '../src/lib/compact-nesting.ts';
import { findCapacity, findNesting } from '../src/lib/nesting.ts';
import { computePanel } from '../src/lib/renderer.ts';
import { nestingConfig } from './nesting-cases.mjs';
import { measurePlaced } from '../src/lib/nesting-types.ts';
import { checkPlacements, flattenOutline } from '../src/lib/nesting-geometry.ts';
import { adoptPlan, readEditableLayout } from '../src/lib/lattice.ts';

function area(panel, placements, dot = 0, padding = 0) {
  const s = measurePlaced(panel, placements, dot, padding);
  return s.width * s.height;
}
test('individual compaction keeps every panel and orientation while freeing edge strips', () => {
  const panel = computePanel({ ...nestingConfig, nSides: 4, sideLen: 10, stitchCount: 0 });
  const initial = [
    { x: 0, y: 0, angle: 0 },
    { x: 40, y: 0, angle: 90 },
    { x: 0, y: 40, angle: 180 },
    { x: 40, y: 40, angle: 270 },
  ];
  const frozen = structuredClone(initial);
  for (const axis of ['x', 'y']) {
    const compact = compactPlacements(panel, initial, 0.245, 0, 2, axis);
    assert.equal(compact.length, 4);
    assert.deepEqual(
      compact.map((p) => p.angle),
      initial.map((p) => p.angle),
    );
    assert.ok(checkPlacements(flattenOutline(panel.outlinePath, 0.002), compact, 0.201));
    assert.ok(area(panel, compact, 0, 2) < area(panel, initial, 0, 2) * 0.3);
    assert.deepEqual(initial, frozen);
    const model = adoptPlan({
      version: 1,
      source: 'compact',
      gap: 0.2,
      rotations: 'quarter',
      placements: compact,
    });
    assert.deepEqual(readEditableLayout(JSON.parse(JSON.stringify(model))).placements, compact);
  }
});
test('capacity refinement locks the first-stage count and never increases the cropped area', () => {
  const panel = computePanel({
    ...nestingConfig,
    nSides: 6,
    hexType: 'truncated',
    hexLong: 19.8,
    hexRatio: 0.38,
    stitchCount: 0,
  });
  const request = {
    panel,
    rotations: 'half',
    gap: 0.2,
    padding: 0,
    dot: 0,
    source: 'density',
    stock: { width: 250, height: 140 },
  };
  const first = findNesting({ ...request, count: 144, currentCols: 12, capacity: true });
  const stages = [];
  const result = findCapacity({ ...request, onCompact: (count) => stages.push(count) });
  assert.deepEqual(stages, [first.placements.length]);
  assert.equal(result.placements.length, first.placements.length);
  assert.ok(area(panel, result.placements) <= area(panel, first.placements));
  assert.ok(area(panel, result.placements) < area(panel, first.placements) - 1);
  const size = measurePlaced(panel, result.placements, 0, 0);
  assert.ok(size.width <= 250 && size.height <= 140);
  assert.ok(result.placements.every((p) => p.angle === 0 || p.angle === 180));
  assert.ok(checkPlacements(flattenOutline(panel.outlinePath, 0.002), result.placements, 0.201));
});
test('a tightly packed one-panel capacity result remains safe and complete', () => {
  const panel = computePanel({ ...nestingConfig, nSides: 4, sideLen: 30, stitchCount: 0 });
  const request = {
    panel,
    rotations: 'none',
    gap: 1,
    padding: 0,
    dot: 0,
    source: 'one',
    stock: { width: 30.17, height: 30.17 },
  };
  const result = findCapacity(request);
  assert.equal(result.placements.length, 1);
  assert.ok(area(panel, result.placements) <= 30.17 ** 2 + 1e-8);
  assert.equal(result.placements[0].angle, 0);
});
