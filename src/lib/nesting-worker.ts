import type { Panel } from '../types';
import { findNesting } from './nesting';
import { flattenOutline, checkPlacements, isSimple } from './nesting-geometry';
import { CLEARANCE_ALLOWANCE, type Placement } from './nesting-types';
self.onmessage = (
  event: MessageEvent<{
    panel: Panel;
    count: number;
    gap: number;
    quarterTurn: boolean;
    source: string;
    padding: number;
    dot: number;
    cols: number;
    placements?: Placement[];
  }>,
) => {
  const r = event.data;
  try {
    if (r.placements) {
      const outline = flattenOutline(r.panel.outlinePath);
      const safe =
        isSimple(outline) && checkPlacements(outline, r.placements, r.gap + CLEARANCE_ALLOWANCE);
      self.postMessage({ safe });
    } else {
      self.postMessage({
        plan: findNesting(
          r.panel,
          r.count,
          r.gap,
          r.quarterTurn,
          r.source,
          r.padding,
          r.dot,
          r.cols,
        ),
      });
    }
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'Unable to check this layout.',
    });
  }
};
