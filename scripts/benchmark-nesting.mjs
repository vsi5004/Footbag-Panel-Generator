import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';
import { createHash } from 'node:crypto';
import { computePanel } from '../src/lib/renderer.ts';
import { findNesting } from '../src/lib/nesting.ts';
import { measurePlaced } from '../src/lib/nesting-types.ts';
import { flattenOutline, checkPlacements } from '../src/lib/nesting-geometry.ts';
import { benchmarkCases } from '../tests/nesting-cases.mjs';

const runs = Number(process.argv.find((a) => a.startsWith('--runs='))?.slice(7) ?? 3);
if (!Number.isInteger(runs) || runs < 1 || runs > 20) throw new Error('Use --runs=1..20');
const cases = [];
for (const { config, name, ...options } of benchmarkCases) {
  const panel = computePanel(config);
  const search = () => findNesting({ panel, ...options });
  let plan = search(); // Warm-up; panel construction and verification are outside timing.
  const times = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    plan = search();
    times.push(performance.now() - start);
  }
  if (
    !checkPlacements(flattenOutline(panel.outlinePath, 0.002), plan.placements, options.gap + 0.001)
  )
    throw new Error(`Unsafe result: ${name}`);
  const size = measurePlaced(panel, plan.placements, options.dot, options.padding);
  cases.push({
    name,
    medianMs: Number(times.sort((a, b) => a - b)[Math.floor(runs / 2)].toFixed(2)),
    count: plan.placements.length,
    widthMm: size.width,
    heightMm: size.height,
    sheetAreaMm2: size.width * size.height,
    resultHash: createHash('sha256').update(JSON.stringify(plan)).digest('hex'),
  });
}
console.log(
  JSON.stringify(
    { runtime: process.version, platform: process.platform, cpu: cpus()[0]?.model, runs, cases },
    null,
    2,
  ),
);
