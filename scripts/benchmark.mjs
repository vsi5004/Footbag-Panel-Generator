import { performance } from 'node:perf_hooks';
import { JSDOM } from 'jsdom';
import { computePanel } from '../src/lib/renderer.ts';
import { createLayoutSvg } from '../src/lib/layout.ts';
globalThis.window = new JSDOM('').window;
globalThis.document = window.document;
const base = {
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
const configs = [3, 4, 5, 6, 10].flatMap((nSides) =>
  [false, true].map((curvedEdges) => ({ ...base, nSides, curvedEdges })),
);
const median = (values) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
function measure(fn, iterations) {
  for (let i = 0; i < 20; i++) fn(i);
  const times = [];
  for (let trial = 0; trial < 5; trial++) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) fn(i);
    times.push((performance.now() - start) / iterations);
  }
  return Number(median(times).toFixed(3));
}
const large = computePanel({ ...base, nSides: 10, stitchCount: 20 });
const opts = {
  rows: 12,
  cols: 12,
  hSpace: 0,
  vSpace: 1,
  invertOdd: true,
  nestingVerticalOffset: 0,
  dotDiameter: 1,
  padding: 10,
  showGrid: false,
};
console.log(
  JSON.stringify(
    {
      runtime: process.version,
      mixedPanelMs: measure((i) => computePanel(configs[i % configs.length]), 1000),
      noHolesMs: measure(
        (i) => computePanel({ ...configs[i % configs.length], stitchCount: 0 }),
        1000,
      ),
      largeSheetMs: measure(() => createLayoutSvg(large, opts), 3),
      largeSheetCircles: createLayoutSvg(large, opts).querySelectorAll('circle').length,
    },
    null,
    2,
  ),
);
