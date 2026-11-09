import type { LayoutElements } from '../types';
import type { NestingPreferences, NestingPlan } from './nesting-types';
import { MAX_STOCK_MM } from './stock-nesting';
const number = (input?: HTMLInputElement | null) => {
  const value = Number(input?.value);
  return input?.value.trim() && Number.isFinite(value) && value > 0
    ? Math.min(MAX_STOCK_MM, Math.max(1, value))
    : undefined;
};
export function collectNestingPreferences(layout?: LayoutElements): NestingPreferences | undefined {
  if (!layout?.nestingMode || !layout.nestingRotation) return undefined;
  const prefs: NestingPreferences = {
    mode: layout.nestingMode.value as NestingPreferences['mode'],
    rotations: layout.nestingRotation.value as NestingPreferences['rotations'],
    gap:
      layout.nestingGap?.value.trim() && Number.isFinite(Number(layout.nestingGap.value))
        ? Math.max(0, Math.min(20, Number(layout.nestingGap.value)))
        : 1,
  };
  const width = number(layout.nestingStockWidth),
    height = number(layout.nestingStockHeight);
  if (width !== undefined) prefs.width = width;
  if (height !== undefined) prefs.height = height;
  return prefs.mode === 'free' &&
    prefs.rotations === 'half' &&
    width === undefined &&
    height === undefined &&
    prefs.gap === 1 &&
    !layout.editable?.current &&
    !layout.nesting?.active
    ? undefined
    : prefs;
}
export function applyNestingPreferences(
  layout: LayoutElements,
  prefs?: NestingPreferences,
  plan?: NestingPlan,
  acceptedGap?: number,
): void {
  if (layout.nestingGap)
    layout.nestingGap.value = String(
      prefs?.gap ?? plan?.gap ?? acceptedGap ?? Number(layout.nestingGap.defaultValue),
    );
  if (layout.nestingMode) layout.nestingMode.value = prefs?.mode ?? plan?.stock?.mode ?? 'free';
  if (layout.nestingRotation)
    layout.nestingRotation.value =
      prefs?.rotations ??
      plan?.rotations ??
      (plan?.placements.some((at) => at.angle === 90 || at.angle === 270) ? 'quarter' : 'half');
  if (layout.nestingStockWidth)
    layout.nestingStockWidth.value = String((prefs ? prefs.width : plan?.stock?.width) ?? '');
  if (layout.nestingStockHeight)
    layout.nestingStockHeight.value = String((prefs ? prefs.height : plan?.stock?.height) ?? '');
}
