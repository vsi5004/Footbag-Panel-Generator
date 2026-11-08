import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { captureCases } from './regression-cases.mjs';

test('36 deployed output cases remain identical apart from the documented utilization correction', () => {
  const baseline = JSON.parse(
    readFileSync(new URL('./fixtures/deployed-baseline.json', import.meta.url), 'utf8'),
  );
  const current = captureCases();
  assert.deepEqual(Object.keys(current), Object.keys(baseline.cases));
  for (const [name, expected] of Object.entries(baseline.cases)) {
    const { utilization: oldUtilization, ...oldOutput } = expected;
    const { utilization, ...output } = current[name];
    assert.deepEqual(output, oldOutput, name);
    // These cases all have positive padding: the full sheet denominator is larger.
    // Exact ratio correctness is checked independently in utilization.test.mjs.
    assert.ok(utilization > 0 && utilization < oldUtilization, name);
  }
});
