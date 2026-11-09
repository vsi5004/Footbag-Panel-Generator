import type { Point } from '../types';
export interface CutPath {
  points: Point[];
  closed: boolean;
  panel: number;
  kind: 'stitch' | 'panel';
}
export const gcodeNumber = (n: number) => Number(n.toFixed(5)).toString();

/** Optional design data for header comments, independent of persistence/UI types. */
export interface DesignSettings {
  layout: { editable?: unknown; optimized?: unknown; showGrid?: unknown; nesting?: unknown };
}
