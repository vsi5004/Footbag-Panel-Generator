import type { Panel } from '../types';
import { findNesting, findCapacity } from './nesting';
import { flattenOutline, checkPlacements, isSimple } from './nesting-geometry';
import {
  CLEARANCE_ALLOWANCE,
  type Placement,
  type StockConstraint,
  type RotationMode,
} from './nesting-types';
import { readStock, readRotations } from './stock-nesting';
self.onmessage = (
  event: MessageEvent<{
    panel: Panel;
    count: number;
    gap: number;
    rotations: RotationMode;
    source: string;
    padding: number;
    dot: number;
    cols: number;
    scalePercent: number;
    stock?: StockConstraint;
    placements?: Placement[];
  }>,
) => {
  self.postMessage({ phase: 'started' });
  const r = event.data;
  try {
    if (r.placements) {
      const outline = flattenOutline(r.panel.outlinePath);
      self.postMessage({
        safe:
          isSimple(outline) && checkPlacements(outline, r.placements, r.gap + CLEARANCE_ALLOWANCE),
      });
    } else {
      const rotations = readRotations(r.rotations);
      const stock = r.stock ? readStock(r.stock) : undefined;
      const scale = r.scalePercent / 100;
      if (!Number.isFinite(scale) || scale <= 0) throw new Error('Invalid export scale');
      const limits = stock
        ? {
            width: stock.width / scale,
            ...(stock.height !== undefined ? { height: stock.height / scale } : {}),
          }
        : undefined;
      const plan =
        stock?.mode === 'capacity'
          ? findCapacity({
              panel: r.panel,
              gap: r.gap,
              rotations,
              source: r.source,
              padding: r.padding,
              dot: r.dot,
              stock: limits!,
              onCompact: (count) => self.postMessage({ phase: 'compact', count }),
            })
          : findNesting({
              panel: r.panel,
              count: r.count,
              gap: r.gap,
              rotations,
              source: r.source,
              padding: r.padding,
              dot: r.dot,
              currentCols: r.cols,
              stock: limits,
            });
      self.postMessage({ plan: { ...plan, rotations, ...(stock ? { stock } : {}) } });
    }
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'Unable to check this layout.',
    });
  }
};
