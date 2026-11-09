import { writeConstraints, updateMaterialSummary } from './cutting-constraints';
import type { EditableLayout } from './lattice';
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
  const accepted = layout.editable?.current ?? layout.nesting?.active;
  const prefs: NestingPreferences = {
    mode: layout.nestingMode.value as NestingPreferences['mode'],
    rotations:
      accepted?.rotations ?? (layout.nestingRotation.value as NestingPreferences['rotations']),
    gap:
      accepted?.gap ??
      (layout.nestingGap?.value.trim() && Number.isFinite(Number(layout.nestingGap.value))
        ? Math.max(0, Math.min(20, Number(layout.nestingGap.value)))
        : 1),
  };
  const width = accepted ? accepted.stock?.width : number(layout.nestingStockWidth),
    height = accepted ? accepted.stock?.height : number(layout.nestingStockHeight);
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
  editable?: EditableLayout,
): void {
  const accepted = editable ?? plan;
  const rotations =
    accepted?.rotations ??
    (plan
      ? plan.placements.some((at) => at.angle === 90 || at.angle === 270)
        ? 'quarter'
        : 'half'
      : (prefs?.rotations ?? 'half'));
  const gap = accepted?.gap ?? prefs?.gap ?? 1;
  const stock = accepted
    ? accepted.stock
    : prefs?.width !== undefined
      ? {
          mode: 'fit' as const,
          width: prefs.width,
          ...(prefs.height !== undefined ? { height: prefs.height } : {}),
        }
      : undefined;
  writeConstraints(layout, { gap, rotations, ...(stock ? { stock } : {}) });
  // Incomplete search-only files may contain a height before a width is supplied.
  if (!accepted && prefs?.width === undefined && layout.nestingStockHeight)
    layout.nestingStockHeight.value = String(prefs?.height ?? '');
  if (layout.nestingMode) layout.nestingMode.value = prefs?.mode ?? accepted?.stock?.mode ?? 'free';
  const conflict =
    accepted &&
    prefs &&
    ((prefs.gap !== undefined && prefs.gap !== gap) ||
      prefs.rotations !== rotations ||
      prefs.width !== stock?.width ||
      prefs.height !== stock?.height);
  const notice = document.getElementById('layoutImportNotice');
  if (notice)
    notice.textContent = conflict
      ? 'Kept the saved layout’s cutting constraints; older search settings differed.'
      : '';
  syncNestingControls(layout);
}

export function syncNestingControls(layout: LayoutElements): void {
  updateMaterialSummary(layout);
  layout.nestingStockWidth?.setAttribute(
    'aria-required',
    String(layout.nestingMode?.value !== 'free'),
  );
  layout.nestingStockHeight?.setAttribute(
    'aria-required',
    String(layout.nestingMode?.value === 'capacity'),
  );
}
