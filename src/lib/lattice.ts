import type { NestingPlan, Placement, RotationMode, StockConstraint } from './nesting-types';
import { readRotations, readStock } from './stock-nesting';

/** A repeated placement pattern, shared by the optimizer and editable layout. */
export interface Lattice {
  columns: number;
  pitchX: number;
  pitchY: number;
  pattern: 0 | 1 | 2 | 3 | 4;
  angle: Placement['angle'];
  rotateAlternates: boolean;
}
export interface EditableLayout extends Lattice {
  count: number;
  gap: number;
  rotations: RotationMode;
  stock?: StockConstraint;
}
export function latticePlacements(lattice: Lattice, count: number): Placement[] {
  const { columns, pitchX, pitchY, pattern, angle, rotateAlternates } = lattice;
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / columns),
      col = i % columns;
    const alternating =
      ((pattern === 1 || pattern === 2) && row % 2) ||
      ((pattern === 3 || pattern === 4) && col % 2);
    return {
      x: Number(((col + (pattern === 2 && row % 2 ? 0.5 : 0)) * pitchX).toFixed(4)),
      y: Number(((row + (pattern === 4 && col % 2 ? 0.5 : 0)) * pitchY).toFixed(4)),
      angle: ((angle + (rotateAlternates && alternating ? 180 : 0)) % 360) as Placement['angle'],
    };
  });
}
const finite = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
export function readLattice(value: unknown): Lattice {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid layout pattern');
  const v = value as Record<string, unknown>;
  if (
    !finite(v.columns, 1, 144) ||
    !Number.isInteger(v.columns) ||
    !finite(v.pitchX, 0, 10000) ||
    !finite(v.pitchY, 0, 10000) ||
    ![0, 1, 2, 3, 4].includes(v.pattern as number) ||
    ![0, 90, 180, 270].includes(v.angle as number) ||
    typeof v.rotateAlternates !== 'boolean'
  )
    throw new Error('Invalid layout pattern');
  return {
    columns: v.columns,
    pitchX: v.pitchX,
    pitchY: v.pitchY,
    pattern: v.pattern as Lattice['pattern'],
    angle: v.angle as Lattice['angle'],
    rotateAlternates: v.rotateAlternates,
  };
}
export function readEditableLayout(value: unknown): EditableLayout {
  const lattice = readLattice(value),
    v = value as Record<string, unknown>;
  if (!finite(v.count, 1, 144) || !Number.isInteger(v.count) || !finite(v.gap, 0, 20))
    throw new Error('Invalid editable layout');
  return {
    ...lattice,
    count: v.count,
    gap: v.gap,
    rotations: readRotations(v.rotations),
    ...(v.stock !== undefined ? { stock: readStock(v.stock) } : {}),
  };
}
export function adoptPlan(plan: NestingPlan): EditableLayout {
  const lattice = readLattice(plan.lattice);
  // Never silently replace imported/custom positions with a different pattern.
  if (
    JSON.stringify(latticePlacements(lattice, plan.placements.length)) !==
    JSON.stringify(plan.placements)
  )
    throw new Error('The candidate does not match its editable pattern. Run the search again.');
  return {
    ...lattice,
    count: plan.placements.length,
    gap: plan.gap,
    rotations: plan.rotations ?? 'half',
    ...(plan.stock ? { stock: { ...plan.stock } } : {}),
  };
}
