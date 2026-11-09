import type { LayoutElements } from '../types';
import { numberFieldError, setFieldError } from './field-feedback';
import { readRotations, readStock } from './stock-nesting';
import type { RotationMode, StockConstraint } from './nesting-types';

export const constraintFields = [
  'nestingGap',
  'nestingRotation',
  'nestingStockWidth',
  'nestingStockHeight',
];
export interface CuttingConstraints {
  gap: number;
  rotations: RotationMode;
  stock?: StockConstraint;
}

export function validateConstraints(
  layout: LayoutElements,
  goal = 'free',
  showErrors = true,
): string[] {
  const errors: string[] = [];
  for (const [field, label, required] of [
    [layout.nestingGap, 'minimum cutting gap', true],
    [
      layout.nestingStockWidth,
      'stock width',
      goal !== 'free' || !!layout.nestingStockHeight?.value,
    ],
    [layout.nestingStockHeight, 'stock height', goal === 'capacity'],
  ] as const) {
    if (!field) continue;
    const error = numberFieldError(field, label, required);
    if (showErrors) setFieldError(field.id, error);
    if (error) errors.push(error);
  }
  return errors;
}

export function readConstraints(layout: LayoutElements): CuttingConstraints {
  const width = layout.nestingStockWidth?.value.trim(),
    height = layout.nestingStockHeight?.value.trim();
  return {
    gap: Number(layout.nestingGap?.value ?? 1),
    rotations: readRotations(layout.nestingRotation?.value ?? 'half'),
    ...(width
      ? {
          stock: readStock({
            mode: 'fit',
            width: Number(width),
            ...(height ? { height: Number(height) } : {}),
          }),
        }
      : {}),
  };
}

export function writeConstraints(layout: LayoutElements, value: CuttingConstraints): void {
  if (layout.nestingGap) layout.nestingGap.value = String(value.gap);
  if (layout.nestingRotation) layout.nestingRotation.value = value.rotations;
  if (layout.nestingStockWidth) layout.nestingStockWidth.value = String(value.stock?.width ?? '');
  if (layout.nestingStockHeight)
    layout.nestingStockHeight.value = String(value.stock?.height ?? '');
  for (const id of constraintFields) setFieldError(id);
  updateMaterialSummary(layout);
}

export function updateMaterialSummary(layout: LayoutElements): void {
  const summary = document.getElementById('materialLimitSummary');
  const width = layout.nestingStockWidth?.value,
    height = layout.nestingStockHeight?.value;
  if (summary)
    summary.textContent = width ? `${width}${height ? ' × ' + height : ' wide'} mm` : 'Optional';
}
