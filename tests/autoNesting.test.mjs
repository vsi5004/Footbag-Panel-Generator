import test from 'node:test';
import assert from 'node:assert/strict';

import {
  autoNestPolygon,
  polygonsOverlap,
} from '../dist-test/autoNesting.js';

const square = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

test('polygonsOverlap rejects coincident polygons', () => {
  assert.equal(polygonsOverlap(square, square), true);
});

test('autoNestPolygon creates distinct non-overlapping placements', () => {
  const placements = autoNestPolygon(square, {
    count: 12,
    sheetWidth: 100,
    sheetHeight: 100,
    margin: 0,
    gap: 1,
    rotations: [0],
  });

  assert.equal(placements.length, 12);

  const uniquePositions = new Set(
    placements.map(p => `${p.x.toFixed(6)},${p.y.toFixed(6)},${p.rotation}`)
  );

  assert.equal(uniquePositions.size, 12);

  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      assert.equal(
        polygonsOverlap(placements[i].points, placements[j].points),
        false,
        `placements ${i} and ${j} overlap`
      );
    }
  }
});
