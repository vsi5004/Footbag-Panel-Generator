import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { computePanel } from '../src/lib/renderer.ts';
import { calculateMaterialUtilization, createLayoutSvg } from '../src/lib/layout.ts';
import { createExportSvg } from '../src/lib/export.ts';

globalThis.window = new JSDOM('').window;
globalThis.document = window.document;

const square = {
  nSides: 4,
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
const options = {
  rows: 2,
  cols: 3,
  hSpace: 4,
  vSpace: 5,
  invertOdd: false,
  nestingVerticalOffset: 0,
  dotDiameter: 1,
  padding: 10,
  showGrid: false,
};
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('utilization uses full exported dimensions, including sheet padding and render allowances', () => {
  const panel = computePanel(square);
  const expected = ((6 * 900) / (121 * 87)) * 100;
  close(calculateMaterialUtilization(panel, options, square), expected);
  const noPadding = calculateMaterialUtilization(panel, { ...options, padding: 0 }, square);
  assert.ok(noPadding > expected);
  const largerDots = calculateMaterialUtilization(panel, { ...options, dotDiameter: 1.5 }, square);
  assert.ok(largerDots < expected);
});

test('all shapes use the dimensions of their exported sheet and preserve export-scale invariance', () => {
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
        const config = { ...square, nSides, hexType, curvedEdges, stitchCount };
        const panel = computePanel(config);
        const ratio = config.hexRatio;
        const halfTip = ((180 - config.starRootAngle) * Math.PI) / 360;
        const innerRadius =
          (config.sideLen * Math.tan(halfTip)) /
          (Math.sin(Math.PI / 5) + Math.tan(halfTip) * Math.cos(Math.PI / 5));
        let panelArea =
          nSides === 10
            ? 5 * config.sideLen * innerRadius * Math.sin(Math.PI / 5)
            : hexType === 'truncated'
              ? (Math.sqrt(3) / 4) * config.hexLong ** 2 * (1 + 4 * ratio + ratio ** 2)
              : (nSides * config.sideLen ** 2) / (4 * Math.tan(Math.PI / nSides));
        if (curvedEdges) {
          const segmentArea = (chord) => {
            const theta = 2 * Math.asin(chord / (2 * config.curveRadius));
            return (config.curveRadius ** 2 / 2) * (theta - Math.sin(theta));
          };
          const starChord = Math.sqrt(
            config.sideLen ** 2 +
              innerRadius ** 2 -
              2 * config.sideLen * innerRadius * Math.cos(Math.PI / 5),
          );
          panelArea +=
            nSides === 10
              ? 10 * segmentArea(starChord)
              : hexType === 'truncated'
                ? 3 * (segmentArea(config.hexLong) + segmentArea(config.hexLong * ratio))
                : nSides * segmentArea(config.sideLen);
        }
        for (const nestingVerticalOffset of [-4, 0, 4]) {
          const opts = { ...options, invertOdd: true, nestingVerticalOffset };
          const svg = createLayoutSvg(panel, opts);
          const utilization = calculateMaterialUtilization(panel, opts, config);
          for (const percent of [75, 100, 125]) {
            const output = createExportSvg(svg, percent);
            const area =
              parseFloat(output.getAttribute('width')) * parseFloat(output.getAttribute('height'));
            close(
              utilization,
              ((panelArea * opts.rows * opts.cols * (percent / 100) ** 2) / area) * 100,
            );
          }
        }
      }
});

test('overlapping panel areas are counted separately and ratios above 100% are not hidden', () => {
  const panel = computePanel(square);
  const opts = { ...options, rows: 2, cols: 2, hSpace: -20, vSpace: -20, padding: 0 };
  close(calculateMaterialUtilization(panel, opts, square), (3600 / (42 * 42)) * 100);
  assert.ok(calculateMaterialUtilization(panel, opts, square) > 100);
});

test('non-positive or non-finite sheet dimensions produce an unavailable metric', () => {
  const panel = computePanel(square);
  for (const changed of [
    { hSpace: -1000 },
    { vSpace: -1000 },
    { hSpace: -1000, vSpace: -1000 },
    { padding: Infinity },
    { hSpace: NaN },
  ]) {
    assert.equal(calculateMaterialUtilization(panel, { ...options, ...changed }, square), null);
  }
});

test('curved area follows rendered arcs and does not invent area for infeasible arcs', () => {
  for (const curveRadius of [10, 60]) {
    const config = { ...square, curvedEdges: true, curveRadius };
    const panel = computePanel(config);
    const svg = createLayoutSvg(panel, options);
    const sheetArea =
      parseFloat(svg.getAttribute('width')) * parseFloat(svg.getAttribute('height'));
    const theta = 2 * Math.asin(30 / (2 * curveRadius));
    const expectedArea =
      curveRadius < 15 ? 900 : 900 + ((4 * curveRadius ** 2) / 2) * (theta - Math.sin(theta));
    close(
      calculateMaterialUtilization(panel, options, config),
      ((expectedArea * 6) / sheetArea) * 100,
    );
  }
});
