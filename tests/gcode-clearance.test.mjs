import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCutInteriors } from '../src/lib/gcode-clearance.ts';
import { generateGcode } from '../src/lib/gcode.ts';
import { computePanel } from '../src/lib/renderer.ts';
import { findCapacity } from '../src/lib/nesting.ts';
import { nestingConfig } from './nesting-cases.mjs';
import { GCODE_DEFAULTS } from '../src/lib/gcode-settings.ts';

test('compensated outlines may share edges or vertices, but cannot overlap interiors', () => {
  const rectangle = [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 20, y: 5 },
    { x: 0, y: 5 },
  ];
  const first = { x: 0, y: 0, angle: 0 };
  for (const second of [
    { x: 20, y: 0, angle: 0 },
    { x: 20, y: 5, angle: 0 },
    { x: 10, y: 5, angle: 0 },
  ])
    assert.equal(checkCutInteriors(rectangle, [first, second]), true);
  for (const second of [
    { x: 19.999, y: 0, angle: 0 },
    { x: 0, y: 0, angle: 0 },
    { x: 10, y: -5, angle: 90 },
  ])
    assert.equal(checkCutInteriors(rectangle, [first, second]), false);
  const concave = [
    { x: 0, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 3 },
    { x: 0, y: 3 },
  ];
  assert.equal(checkCutInteriors(concave, [first, { x: 1, y: 1, angle: 0 }]), true);
  assert.equal(checkCutInteriors(concave, [first, { x: 0.5, y: 0, angle: 0 }]), false);
});

test('equal kerf and panel gap generate shared cuts at every export scale, including zero kerf', () => {
  const panel = computePanel({ ...nestingConfig, nSides: 4, sideLen: 30, stitchCount: 0 });
  for (const scale of [50, 100, 125])
    for (const gap of [0, 0.2]) {
      const optimized = {
        placements: [
          { x: 0, y: 0, angle: 0 },
          { x: 30 + gap, y: 0, angle: 0 },
        ],
      };
      const result = generateGcode(
        panel,
        { optimized, rows: 1, cols: 2, padding: 0, dotDiameter: 0, showGrid: false },
        scale,
        { ...GCODE_DEFAULTS, kerf: (gap * scale) / 100 },
      );
      assert.equal(result.paths.length, 2);
      const edges = (p) =>
        p.points.map((a, i) => {
          const b = p.points[(i + 1) % p.points.length];
          return [a, b]
            .map((v) => `${v.x.toFixed(5)},${v.y.toFixed(5)}`)
            .sort()
            .join(':');
        });
      const a = new Set(edges(result.paths[0]));
      assert.equal(edges(result.paths[1]).filter((e) => a.has(e)).length, 1);
      if (gap) assert.ok(result.extent.minX < 0); // Compensation may leave the material edge.
      if (gap)
        assert.throws(
          () =>
            generateGcode(
              panel,
              { optimized, padding: 0, dotDiameter: 0, showGrid: false },
              scale,
              { ...GCODE_DEFAULTS, kerf: ((gap + 0.001) * scale) / 100 },
            ),
          /space|overlap/,
        );
    }
});

test('exact screenshot layout exports with 0.2 mm gap and kerf at zero padding', () => {
  const panel = computePanel({
    ...nestingConfig,
    nSides: 6,
    hexType: 'truncated',
    hexLong: 19.8,
    hexRatio: 0.38,
    stitchCount: 0,
  });
  const plan = findCapacity({
    panel,
    gap: 0.2,
    rotations: 'half',
    padding: 0,
    dot: 0,
    source: 'kerf-screenshot',
    stock: { width: 250, height: 140 },
  });
  assert.ok(plan.placements.length >= 56);
  const result = generateGcode(
    panel,
    { optimized: plan, padding: 0, dotDiameter: 0, showGrid: false },
    100,
    { ...GCODE_DEFAULTS, kerf: 0.2 },
  );
  assert.equal(result.paths.length, plan.placements.length);
  assert.ok(!/NaN|Infinity/.test(result.code));
  assert.throws(
    () =>
      generateGcode(panel, { optimized: plan, padding: 0, dotDiameter: 0, showGrid: false }, 100, {
        ...GCODE_DEFAULTS,
        kerf: 0.5,
      }),
    /0.500 mm.*Minimum cutting gap.*Laser kerf width/,
  );
});
