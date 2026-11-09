import type { Lattice } from './lattice';
import { CONSTANTS } from './constants';
import type { Point, Panel, PanelConfig } from '../types';
export interface Placement {
  x: number;
  y: number;
  angle: 0 | 90 | 180 | 270;
  flipY?: boolean;
}
export type RotationMode = 'none' | 'half' | 'quarter';
export type SearchMode = 'free' | 'fit' | 'capacity';
export interface StockSize {
  width: number;
  height?: number;
}
export interface StockConstraint extends StockSize {
  mode: 'fit' | 'capacity';
}
export interface NestingPreferences {
  gap?: number;
  mode: SearchMode;
  rotations: RotationMode;
  width?: number;
  height?: number;
}
export interface NestingPlan {
  version: 1;
  lattice?: Lattice;
  source: string;
  gap: number;
  rotations?: RotationMode;
  stock?: StockConstraint;
  placements: Placement[];
}
export interface NestingState {
  constraintsEdited?: boolean;
  active?: NestingPlan;
}
export const OUTLINE_TOLERANCE = 0.02;
export const CLEARANCE_ALLOWANCE = 2 * OUTLINE_TOLERANCE + 0.005;
export function designKey(c: PanelConfig, dot: number, count: number): string {
  return JSON.stringify([
    c.nSides,
    c.sideLen,
    c.seamOffset,
    c.stitchCount,
    c.curvedEdges,
    c.hexType,
    c.hexLong,
    c.hexRatio,
    c.curveRadius,
    c.holeSpacing,
    c.holeBunching,
    c.cornerMargin,
    c.starRootOffset,
    c.starRootAngle,
    c.cornerStitchSpacing,
    c.cornerStitchDistance,
    dot,
    count,
  ]);
}
export function transform(p: Point, at: Placement): Point {
  const y = at.flipY ? -p.y : p.y;
  switch (at.angle) {
    case 90:
      return { x: at.x - y, y: at.y + p.x };
    case 180:
      return { x: at.x - p.x, y: at.y - y };
    case 270:
      return { x: at.x + y, y: at.y - p.x };
    default:
      return { x: at.x + p.x, y: at.y + y };
  }
}
export function bounds(points: Point[]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}
export function measurePlaced(panel: Panel, placements: Placement[], dot: number, padding: number) {
  const b = panel.bounds,
    pad = Math.max(CONSTANTS.STROKES.cut / 2, dot / 2);
  const x = b.viewMinX + CONSTANTS.LAYOUT.MARGIN_MM - pad,
    y = b.viewMinY + CONSTANTS.LAYOUT.MARGIN_MM - pad,
    w = b.width - 2 * CONSTANTS.LAYOUT.MARGIN_MM + 2 * pad,
    h = b.height - 2 * CONSTANTS.LAYOUT.MARGIN_MM + 2 * pad;
  const corners = [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
  const box = bounds(placements.flatMap((at) => corners.map((p) => transform(p, at))));
  return {
    minX: box.minX - padding,
    minY: box.minY - padding,
    width: box.width + 2 * padding,
    height: box.height + 2 * padding,
  };
}
