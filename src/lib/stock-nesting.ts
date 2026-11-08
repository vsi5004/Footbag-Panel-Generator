import type { Panel } from '../types';
import {
  measurePlaced,
  type NestingPlan,
  type RotationMode,
  type StockConstraint,
  type NestingPreferences,
} from './nesting-types';
export const MAX_STOCK_MM = 10000;
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function dimension(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= MAX_STOCK_MM;
}
export function readRotations(value: unknown): RotationMode {
  if (value !== 'none' && value !== 'half' && value !== 'quarter')
    throw new Error('Invalid nesting rotations');
  return value;
}
export function readStock(value: unknown): StockConstraint {
  if (
    !object(value) ||
    !dimension(value.width) ||
    (value.height !== undefined && !dimension(value.height)) ||
    (value.mode !== 'fit' && value.mode !== 'capacity') ||
    (value.mode === 'capacity' && value.height === undefined)
  )
    throw new Error('Invalid stock limits');
  return {
    mode: value.mode,
    width: value.width,
    ...(value.height !== undefined ? { height: value.height as number } : {}),
  };
}
export function readNestingPreferences(value: unknown): NestingPreferences {
  if (
    !object(value) ||
    !['free', 'fit', 'capacity'].includes(value.mode as string) ||
    (value.width !== undefined && !dimension(value.width)) ||
    (value.height !== undefined && !dimension(value.height))
  )
    throw new Error('Invalid nesting preferences');
  return {
    mode: value.mode as NestingPreferences['mode'],
    rotations: readRotations(value.rotations),
    ...(value.width !== undefined ? { width: value.width as number } : {}),
    ...(value.height !== undefined ? { height: value.height as number } : {}),
  };
}
export function fitsStock(
  panel: Panel,
  plan: NestingPlan,
  dot: number,
  padding: number,
  scalePercent: number,
): boolean {
  if (!plan.stock) return true;
  const box = measurePlaced(panel, plan.placements, dot, padding),
    scale = scalePercent / 100;
  return (
    Number.isFinite(scale) &&
    scale > 0 &&
    box.width * scale <= plan.stock.width + 1e-8 &&
    (plan.stock.height === undefined || box.height * scale <= plan.stock.height + 1e-8)
  );
}
