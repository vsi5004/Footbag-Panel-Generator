import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePanel } from '../src/lib/renderer.ts';
import { nestingConfig } from './nesting-cases.mjs';
import { findCapacity, findNesting } from '../src/lib/nesting.ts';
import { checkPlacements, flattenOutline } from '../src/lib/nesting-geometry.ts';
import { measurePlaced } from '../src/lib/nesting-types.ts';
import { calculateMaterialUtilization } from '../src/lib/layout.ts';
import { adoptPlan, latticePlacements, readEditableLayout } from '../src/lib/lattice.ts';

const config = {
  ...nestingConfig,
  nSides: 6,
  hexType: 'truncated',
  hexLong: 20,
  hexRatio: 0.4,
  stitchCount: 0,
};
const panel = computePanel(config);
const base = { panel, gap: 0.2, padding: 0, dot: 0, rotations: 'quarter', source: 'hex-40' };
function verify(plan, rotations = 'quarter') {
  assert.ok(checkPlacements(flattenOutline(panel.outlinePath, 0.002), plan.placements, 0.201));
  assert.ok(plan.placements.every((p) => !p.flipY && (rotations !== 'none' || p.angle === 0)));
  const model = adoptPlan({ ...plan, rotations });
  assert.deepEqual(latticePlacements(model, model.count), plan.placements);
  assert.deepEqual(readEditableLayout(JSON.parse(JSON.stringify(model))), model);
}
test('40% uneven hexagons reach 85%+ in a 144-panel layout without forced flips', () => {
  const plan = findNesting({ ...base, count: 144, currentCols: 12 });
  const used = calculateMaterialUtilization(
    panel,
    { optimized: plan, dotDiameter: 0, padding: 0 },
    config,
  );
  assert.ok(used >= 85.5 && used < 100, `Actual utilization: ${used}`);
  assert.equal(plan.placements.length, 144);
  assert.equal(plan.lattice.rotateAlternates, false);
  assert.equal(plan.lattice.columns, 4); // Previously only a few column counts were tried.
  verify(plan);
  const constrained = findNesting({ ...base, rotations: 'none', count: 144, currentCols: 12 });
  verify(constrained, 'none');
});
test('40% uneven hexagon capacity improves from 45 to at least 52 on 145 by 230 stock', () => {
  const plan = findCapacity({ ...base, stock: { width: 145, height: 230 } });
  assert.ok(plan.placements.length >= 52);
  const size = measurePlaced(panel, plan.placements, 0, 0);
  assert.ok(size.width <= 145 && size.height <= 230);
  assert.ok(checkPlacements(flattenOutline(panel.outlinePath, 0.002), plan.placements, 0.201));
  assert.deepEqual(findCapacity({ ...base, stock: { width: 145, height: 230 } }), plan);
});
test('translation trials improve smaller jobs and still satisfy fixed stock limits', () => {
  const plan = findNesting({ ...base, count: 36, currentCols: 6 });
  const used = calculateMaterialUtilization(
    panel,
    { optimized: plan, dotDiameter: 0, padding: 0 },
    config,
  );
  assert.ok(used > 80); // Merged main: 76.42%.
  verify(plan);
  const size = measurePlaced(panel, plan.placements, 0, 0);
  const fit = findNesting({
    ...base,
    count: 36,
    currentCols: 6,
    stock: { width: size.width + 0.001, height: size.height + 0.001 },
  });
  assert.equal(fit.placements.length, 36);
  assert.ok(checkPlacements(flattenOutline(panel.outlinePath, 0.002), fit.placements, 0.201));
});
