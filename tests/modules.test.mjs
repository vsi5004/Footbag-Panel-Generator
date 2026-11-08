import { test } from 'node:test';
import assert from 'node:assert/strict';

test('geometry and application modules can be imported without window or document', async () => {
  assert.equal(typeof globalThis.window, 'undefined');
  const { geometry } = await import('../src/lib/geometry.ts');
  const { computePanel } = await import('../src/lib/renderer.ts');
  const { state } = await import('../src/lib/state.ts');
  assert.equal(geometry.regularPolygonVertices(5, 30).length, 5);
  assert.equal(typeof computePanel, 'function');
  assert.equal(typeof state.apply, 'function');
  assert.equal(typeof globalThis.window, 'undefined');
});
