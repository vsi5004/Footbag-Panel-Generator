import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computePanel } from '../src/lib/renderer.ts';
import { generateGcode } from '../src/lib/gcode.ts';
import { createJobSnapshot } from '../src/lib/gcode-job.ts';
import { runGcodeJob } from '../src/lib/gcode-runner.ts';
import { GcodeService } from '../src/lib/gcode-service.ts';
import { parseGcode } from '../src/lib/gcode-preview.ts';
import { gcodeWords, validateStartCode } from '../src/lib/gcode-dialect.ts';

const fixtures = JSON.parse(
  readFileSync(new URL('./fixtures/gcode.json', import.meta.url), 'utf8'),
);
for (const fixture of fixtures) {
  test(`GCode stays byte-identical to pre-refactor ${fixture.name} fixture`, () => {
    const panel = computePanel(fixture.config);
    const result = generateGcode(
      panel,
      fixture.opts,
      fixture.scale,
      fixture.settings,
      fixture.designSettings,
    );
    assert.equal(result.code, fixture.code);
    const snapshot = createJobSnapshot(
      { panel, opts: fixture.opts },
      fixture.scale,
      fixture.settings,
      fixture.designSettings,
    );
    const job = runGcodeJob(snapshot);
    assert.equal(job.code, fixture.code);
    const parsed = parseGcode(fixture.code);
    assert.equal(job.cutDistance, parsed.cutDistance);
    assert.equal(job.travelDistance, parsed.travelDistance);
    assert.equal(job.cutCount, result.paths.length);
    for (const move of parsed.moves) {
      const path = move.cut ? job.preview.cut : job.preview.travel;
      assert.ok(path.length);
    }
  });
}

test('start validation shares preview word grammar, including compact program-end commands', () => {
  for (const code of ['M2G90', 'M02X0', 'm30g21', 'M 2', 'M+2.0G90']) {
    assert.throws(() => validateStartCode(code), /program-end/);
    const f = fixtures[0];
    assert.throws(
      () => generateGcode(computePanel(f.config), f.opts, 100, { ...f.settings, startCode: code }),
      /program-end/,
    );
    assert.equal(parseGcode(`${code}\nM4 S100\nG1 X20 Y20`).moves.length, 0);
  }
  for (const code of ['; M2G90\nG21', '(M30) G90', 'M20', 'M200', 'M3 S0'])
    assert.doesNotThrow(() => validateStartCode(code));
  assert.deepEqual(gcodeWords('g1x-2.5Y.5 (M2) ; M30'), [
    ['G', 1],
    ['X', -2.5],
    ['Y', 0.5],
  ]);
});

test('snapshots are immutable copies and keys include every cut input but exclude preview/search changes', () => {
  const f = fixtures[0],
    panel = computePanel(f.config),
    opts = structuredClone(f.opts);
  const metadata = {
    side: 30,
    showGrid: false,
    layout: { editable: false, nesting: { goal: 'strip' }, showGrid: false },
  };
  const settings = { ...f.settings, includeSettings: true };
  const snap = createJobSnapshot({ panel, opts }, 100, settings, metadata);
  assert.ok(Object.isFrozen(snap.input.panel.stitches[0]));
  assert.throws(() => snap.input.panel.stitches.push({ x: 0, y: 0 }), TypeError);
  opts.showGrid = true;
  metadata.showGrid = true;
  metadata.layout.nesting.goal = 'square';
  metadata.layout.showGrid = true;
  assert.equal(createJobSnapshot({ panel, opts }, 100, settings, metadata).key, snap.key);
  metadata.side = 31;
  assert.notEqual(createJobSnapshot({ panel, opts }, 100, settings, metadata).key, snap.key);
  assert.equal(snap.input.designSettings.side, 30);
  const withoutMetadata = createJobSnapshot({ panel, opts }, 100, f.settings);
  opts.padding++;
  assert.notEqual(createJobSnapshot({ panel, opts }, 100, f.settings).key, withoutMetadata.key);
  assert.notEqual(
    createJobSnapshot({ panel, opts: f.opts }, 125, f.settings).key,
    withoutMetadata.key,
  );
  assert.notEqual(
    createJobSnapshot({ panel, opts: f.opts }, 100, { ...f.settings, cutPower: 20 }).key,
    withoutMetadata.key,
  );
  const nested = {
    ...f.opts,
    optimized: { placements: [{ x: 70, y: 70, angle: 90 }], source: 'search a', gap: 2 },
  };
  const accepted = createJobSnapshot({ panel, opts: nested }, 100, f.settings);
  nested.optimized.source = 'search b';
  nested.optimized.gap = 4;
  assert.equal(createJobSnapshot({ panel, opts: nested }, 100, f.settings).key, accepted.key);
  nested.optimized.placements[0].x++;
  assert.notEqual(createJobSnapshot({ panel, opts: nested }, 100, f.settings).key, accepted.key);
});

class FakeWorker {
  terminated = false;
  postMessage(message) {
    this.message = message;
  }
  terminate() {
    this.terminated = true;
  }
  complete(data) {
    this.onmessage?.({ data });
  }
}

test('superseded workers are terminated and cannot resolve the replacement job', async () => {
  const workers = [],
    service = new GcodeService(() => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    });
  const f = fixtures[0],
    snapshot = createJobSnapshot({ panel: computePanel(f.config), opts: f.opts }, 100, f.settings);
  const first = service.generate(snapshot);
  const cancelled = assert.rejects(first, { name: 'AbortError' });
  const second = service.generate(snapshot);
  await cancelled;
  assert.equal(workers[0].terminated, true);
  workers[0].complete({ result: { code: 'obsolete' } });
  workers[1].complete({ result: { code: 'current' } });
  assert.equal((await second).code, 'current');
  assert.equal(workers[1].terminated, true);
  const third = service.generate(snapshot),
    aborted = assert.rejects(third, { name: 'AbortError' });
  service.cancel();
  await aborted;
  assert.equal(workers[2].terminated, true);
});

test('worker failures terminate resources and allow retry', async () => {
  const workers = [],
    service = new GcodeService(() => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    });
  const f = fixtures[0],
    snapshot = createJobSnapshot({ panel: computePanel(f.config), opts: f.opts }, 100, f.settings);
  for (const failure of ['reported', 'error', 'messageerror']) {
    const pending = service.generate(snapshot),
      rejected = assert.rejects(pending, /problem|Unable/);
    const worker = workers.at(-1);
    if (failure === 'reported') worker.complete({ error: 'problem' });
    else worker[`on${failure}`]();
    await rejected;
    assert.equal(worker.terminated, true);
  }
  const pending = service.generate(snapshot);
  workers.at(-1).complete({ result: { code: 'retry' } });
  assert.equal((await pending).code, 'retry');
});
