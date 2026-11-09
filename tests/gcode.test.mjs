import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import Ajv2020 from 'ajv/dist/2020.js';
import { generateGcode, orderCuts, flattenCutOutline, offsetOutline } from '../src/lib/gcode.ts';
import { parseGcode } from '../src/lib/gcode-preview.ts';
import {
  GCODE_DEFAULTS,
  readGcodeSettings,
  applyGcodeSettings,
} from '../src/lib/gcode-settings.ts';
import { computePanel } from '../src/lib/renderer.ts';
import { bounds } from '../src/lib/nesting-types.ts';
import { state } from '../src/lib/state.ts';
import { createMainElements, getLayoutElements } from '../src/lib/dom.ts';
import { CutIndex } from '../src/lib/gcode-routing.ts';
import { GCODE_LIMITS } from '../src/lib/gcode-settings.ts';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
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
  cornerMargin: 2,
  starRootOffset: -1.5,
  starRootAngle: 128,
  cornerStitchSpacing: false,
  cornerStitchDistance: 3,
};
const opts = {
  rows: 2,
  cols: 2,
  hSpace: 2,
  vSpace: 2,
  dotDiameter: 1,
  showGrid: false,
  invertOdd: false,
  nestingVerticalOffset: 0,
  padding: 10,
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function fresh() {
  globalThis.window = new JSDOM(html).window;
  globalThis.document = window.document;
  applyGcodeSettings();
  return { el: createMainElements(), layout: getLayoutElements() };
}
fresh();

test('power scales, slits, kerf and machine commands match physical output at every export scale', () => {
  const panel = computePanel(config);
  for (const powerMax of [1, 1000])
    for (const scale of [50, 100, 125]) {
      const settings = { ...GCODE_DEFAULTS, powerMax, cutPower: 45, kerf: 0.15, cutSpeed: 1350 };
      const result = generateGcode(panel, opts, scale, settings);
      assert.match(result.code, new RegExp(`S${powerMax * 0.45} F1350`));
      assert.ok(result.code.startsWith('; Footbag'));
      assert.ok(result.code.endsWith('M2          ; End\n'));
      assert.equal(result.paths.length, (panel.stitches.length + 1) * 4);
      const stitches = result.paths.filter((p) => p.kind === 'stitch');
      for (const p of stitches)
        assert.ok(Math.abs(distance(...p.points) - (scale / 100 - 0.15)) < 1e-8);
      const firstPanel = result.paths.findIndex((p) => p.kind === 'panel');
      assert.equal(firstPanel, stitches.length);
      const parsed = parseGcode(result.code);
      assert.equal(parsed.warnings.length, 0);
      const independentLength = result.paths.reduce(
        (sum, p) =>
          sum +
          p.points.slice(1).reduce((s, q, i) => s + distance(q, p.points[i]), 0) +
          (p.closed ? distance(p.points[0], p.points.at(-1)) : 0),
        0,
      );
      assert.ok(Math.abs(parsed.cutDistance - independentLength) < 0.01);
      assert.equal(
        parsed.moves.filter((m) => m.cut).length,
        result.paths.reduce((s, p) => s + p.points.length - (p.closed ? 0 : 1), 0),
      );
      for (const line of result.code.split('\n'))
        if (line.startsWith('G0')) assert.equal(line.includes('S'), false);
      assert.ok(result.code.includes('S0\nG0'));
    }
});

test('all ordering policies have their promised dependencies and preserve every cut', () => {
  const paths = [
    {
      panel: 0,
      kind: 'panel',
      closed: true,
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
    },
    {
      panel: 0,
      kind: 'stitch',
      closed: false,
      points: [
        { x: 50, y: 0 },
        { x: 51, y: 0 },
      ],
    },
    {
      panel: 1,
      kind: 'stitch',
      closed: false,
      points: [
        { x: 20, y: 0 },
        { x: 19, y: 0 },
      ],
    },
    {
      panel: 1,
      kind: 'panel',
      closed: true,
      points: [
        { x: 15, y: 0 },
        { x: 25, y: 0 },
        { x: 25, y: 10 },
      ],
    },
  ];
  const safe = orderCuts(paths, 'all-stitches-first');
  assert.deepEqual(
    safe.map((p) => p.kind),
    ['stitch', 'stitch', 'panel', 'panel'],
  );
  const per = orderCuts(paths, 'panel-by-panel');
  assert.deepEqual(
    per.map((p) => [p.panel, p.kind]),
    [
      [1, 'stitch'],
      [1, 'panel'],
      [0, 'stitch'],
      [0, 'panel'],
    ],
  );
  assert.equal(per[0].points[0].x, 19); // reverse slit to enter nearest endpoint
  const free = orderCuts(paths, 'optimized');
  assert.equal(free[0].kind, 'panel');
  for (const mode of ['all-stitches-first', 'panel-by-panel', 'optimized']) {
    assert.equal(orderCuts(paths, mode).length, paths.length);
    assert.deepEqual(orderCuts(paths, mode), orderCuts(paths, mode));
  }
});

test('offsets expand outer boundaries and curve segmentation follows the selected length', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  assert.deepEqual(bounds(offsetOutline(square, 0.1)), {
    minX: -0.1,
    minY: -0.1,
    maxX: 10.1,
    maxY: 10.1,
    width: 10.2,
    height: 10.2,
  });
  const path =
    'M 10 0 A 10 10 0 0 1 0 10 A 10 10 0 0 1 -10 0 A 10 10 0 0 1 0 -10 A 10 10 0 0 1 10 0 Z';
  const fine = flattenCutOutline(path, 0.1),
    coarse = flattenCutOutline(path, 0.5);
  assert.ok(fine.length > coarse.length * 4);
  for (let i = 0; i < fine.length; i++)
    assert.ok(distance(fine[i], fine[(i + 1) % fine.length]) <= 0.100001);
});

test('rotations, flips, curved/concave outlines, zero stitches, and hole outlines generate finite physical paths', () => {
  for (const nSides of [3, 4, 5, 6, 10])
    for (const curvedEdges of [false, true]) {
      const panel = computePanel({ ...config, nSides, curvedEdges });
      for (const stitchMode of ['slit', 'outline']) {
        const result = generateGcode(panel, { ...opts, rows: 1, cols: 1 }, 100, {
          ...GCODE_DEFAULTS,
          stitchMode,
        });
        assert.ok(!/NaN|Infinity/.test(result.code));
        assert.ok(
          result.paths.every((p) => p.closed === (p.kind === 'panel' || stitchMode === 'outline')),
        );
      }
    }
  const panel = computePanel(config);
  const optimized = { placements: [{ x: 100, y: 100, angle: 90, flipY: true }] };
  const result = generateGcode(panel, { ...opts, optimized }, 125, GCODE_DEFAULTS);
  for (const p of result.paths.filter((p) => p.kind === 'stitch'))
    assert.ok(Math.abs(p.points[0].x - p.points[1].x) < 1e-8);
  const noHoles = computePanel({ ...config, stitchCount: 0 });
  assert.equal(
    generateGcode(noHoles, { ...opts, rows: 1, cols: 1 }, 100, GCODE_DEFAULTS).paths.length,
    1,
  );
});

test('invalid cuts reject overlap, collapsed stitch holes, nonfinite settings, and insufficient sheet padding', () => {
  const panel = computePanel(config);
  assert.throws(() => generateGcode(panel, opts, 100, { ...GCODE_DEFAULTS, kerf: 1 }), /diameter/);
  assert.throws(
    () => generateGcode(panel, { ...opts, hSpace: -20 }, 100, GCODE_DEFAULTS),
    /overlap|space/,
  );
  assert.throws(
    () =>
      generateGcode(panel, { ...opts, rows: 1, cols: 1, dotDiameter: 0.2, padding: 0 }, 100, {
        ...GCODE_DEFAULTS,
        kerf: 0.5,
      }),
    /diameter|padding/,
  );
  assert.throws(() => readGcodeSettings({ ...GCODE_DEFAULTS, cutPower: NaN }), /cutPower/);
  assert.throws(() => readGcodeSettings({ ...GCODE_DEFAULTS, kerf: null }), /kerf/);
});

test('settings JSON round trips, old files reset defaults, invalid GCode imports remain atomic', () => {
  const { el, layout } = fresh();
  document.getElementById('gcode-startCode').value = 'G21\nG90\nM4 S0\n; Custom header';
  document.getElementById('gcode-cutOrder').value = 'panel-by-panel';
  document.getElementById('gcode-powerMax').value = '1';
  const saved = JSON.parse(JSON.stringify(state.collect(el, layout)));
  const schema = JSON.parse(
    readFileSync(new URL('../schema/settings.schema.json', import.meta.url), 'utf8'),
  );
  assert.equal(new Ajv2020({ strict: false }).validate(schema, saved), true);
  applyGcodeSettings();
  state.apply(el, JSON.parse(JSON.stringify(saved)), layout);
  assert.deepEqual(state.collect(el, layout).gcode, saved.gcode);
  const before = state.collect(el, layout);
  assert.throws(
    () => state.apply(el, { ...saved, side: 60, gcode: { ...saved.gcode, cutSpeed: -1 } }, layout),
    /cutSpeed/,
  );
  assert.deepEqual(state.collect(el, layout), before);
  delete saved.gcode;
  state.apply(el, saved, layout);
  assert.deepEqual(state.collect(el, layout).gcode, GCODE_DEFAULTS);
});

test('preview reads modal power and travel, custom linear moves, units and program end from actual text', () => {
  const p = parseGcode(
    'G21\nG90\nM4 S0\nG0 X10 Y0\nG1 X20 Y0 S100 F1000\nS0\nG1 X30 Y0\nG91\nG1 X1 Y2\nM5\nG20\nG90\nG0 X1 Y1\nM2\nG0 X1000',
  );
  assert.equal(p.cutDistance, 10);
  assert.deepEqual(p.moves.at(-1).to, { x: 25.4, y: 25.4 });
  assert.equal(p.warnings.length, 0);
  assert.deepEqual(parseGcode('G28\nG2 X1 Y2 I3').warnings, ['G28', 'G2']);
});

test('spatial routing finds the nearest active entry through disabled, re-enabled and tied paths', () => {
  const paths = Array.from({ length: 400 }, (_, i) => ({
    points: [
      { x: (i * 37) % 103, y: (i * 19) % 79 },
      { x: ((i * 37) % 103) + 0.7, y: ((i * 19) % 79) + 0.5 },
    ],
    closed: i % 3 === 0,
    panel: i,
    kind: 'stitch',
  }));
  const active = paths.map((_, i) => i % 4 !== 0),
    index = new CutIndex(paths, active);
  for (let step = 0; step < 200; step++) {
    const id = (step * 11) % paths.length;
    active[id] = !active[id];
    index.enable(id, active[id]);
    const cursor = { x: step * 0.5, y: step * 0.2 };
    const allowed = (i) => i % 3 !== step % 3;
    const candidates = paths
      .flatMap((p, i) =>
        active[i] && allowed(i)
          ? p.points.map((q, start) => ({
              path: i,
              start,
              d: (q.x - cursor.x) ** 2 + (q.y - cursor.y) ** 2,
            }))
          : [],
      )
      .sort((a, b) => a.d - b.d || a.path - b.path || a.start - b.start);
    const nearest = index.nearest(cursor, allowed);
    assert.equal(nearest.path, candidates[0].path);
    assert.equal(nearest.start, candidates[0].start);
  }
});

test('machine defaults, schema and input numeric limits agree', () => {
  fresh();
  const schema = JSON.parse(
    readFileSync(new URL('../schema/settings.schema.json', import.meta.url), 'utf8'),
  );
  for (const [key, [min, max]] of Object.entries(GCODE_LIMITS)) {
    const el = document.getElementById(`gcode-${key}`),
      definition = schema.properties.gcode.properties[key];
    assert.equal(Number(el.min), min);
    assert.equal(Number(el.max), max);
    assert.equal(Number(el.value), GCODE_DEFAULTS[key]);
    assert.equal(definition.minimum, min);
    assert.equal(definition.maximum, max);
  }
});

test('maximum sheet count keeps all stitches ahead of every outline', () => {
  const panel = computePanel({ ...config, nSides: 6, stitchCount: 8 });
  const result = generateGcode(panel, { ...opts, rows: 12, cols: 12 }, 100, GCODE_DEFAULTS);
  const holes = panel.stitches.length * 144;
  assert.equal(result.paths.length, holes + 144);
  assert.ok(result.paths.slice(0, holes).every((p) => p.kind === 'stitch'));
  assert.ok(result.paths.slice(holes).every((p) => p.kind === 'panel'));
});
