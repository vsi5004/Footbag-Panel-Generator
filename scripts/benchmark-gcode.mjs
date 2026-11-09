import { computePanel } from '../src/lib/renderer.ts';
import { generateGcode } from '../src/lib/gcode.ts';
import { parseGcode } from '../src/lib/gcode-preview.ts';
import { GCODE_DEFAULTS } from '../src/lib/gcode-settings.ts';
const config = {
  nSides: 6,
  sideLen: 30,
  seamOffset: 5,
  stitchCount: 8,
  curvedEdges: true,
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
const panel = computePanel(config);
const base = {
  hSpace: 2,
  vSpace: 2,
  dotDiameter: 1.5,
  showGrid: false,
  invertOdd: false,
  nestingVerticalOffset: 0,
  padding: 10,
};
for (const [name, count, stitchMode, segmentLength] of [
  ['9 panels/slits', 3, 'slit', 0.2],
  ['144 panels/slits', 12, 'slit', 0.2],
  ['144 panels/hole outlines/0.1mm', 12, 'outline', 0.1],
]) {
  const timings = [];
  for (let i = 0; i < 3; i++) {
    global.gc?.();
    const start = performance.now();
    const result = generateGcode(panel, { ...base, rows: count, cols: count }, 100, {
      ...GCODE_DEFAULTS,
      stitchMode,
      segmentLength,
    });
    const generated = performance.now();
    const preview = parseGcode(result.code);
    const parsed = performance.now();
    timings.push({
      generateMs: Math.round(generated - start),
      parseMs: Math.round(parsed - generated),
      paths: result.paths.length,
      moves: preview.moves.length,
      codeMB: +(result.code.length / 1e6).toFixed(2),
      heapMB: Math.round(process.memoryUsage().heapUsed / 1e6),
    });
  }
  console.log(JSON.stringify({ name, timings }));
}
