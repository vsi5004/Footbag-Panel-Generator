import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { captureCases } from './regression-cases.mjs';

test('36 deployed geometry, stitching, layout, utilization, constraint and export cases remain identical', () => {
  const baseline = JSON.parse(
    readFileSync(new URL('./fixtures/deployed-baseline.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(captureCases(), baseline.cases);
});
