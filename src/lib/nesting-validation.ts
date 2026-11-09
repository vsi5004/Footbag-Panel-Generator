import type { Panel, PanelConfig } from '../types';
import { flattenOutline, checkPlacements, isSimple } from './nesting-geometry';
import { designKey, CLEARANCE_ALLOWANCE, type NestingPlan } from './nesting-types';

// Bounded by actual cut geometry so new stitch configurations reuse clearance.
const verified = new Map<string, 'outline' | 'clearance' | null>();
export type PlanProblem = 'design' | 'rotations' | 'outline' | 'clearance';
export function planProblem(
  plan: NestingPlan,
  panel: Panel,
  config: PanelConfig,
  dot: number,
  count: number,
): PlanProblem | undefined {
  const key = designKey(config, dot, count);
  if (plan.source !== key || (plan.stock?.mode !== 'capacity' && plan.placements.length !== count))
    return 'design';
  if (
    plan.rotations &&
    plan.placements.some(
      (at) =>
        at.flipY ||
        (plan.rotations === 'none' && at.angle !== 0) ||
        (plan.rotations === 'half' && at.angle % 180 !== 0),
    )
  )
    return 'rotations';
  const geometryKey = JSON.stringify([panel.outlinePath, plan.placements, plan.gap]);
  if (verified.has(geometryKey)) return verified.get(geometryKey) ?? undefined;
  const outline = flattenOutline(panel.outlinePath);
  const problem = !isSimple(outline)
    ? 'outline'
    : !checkPlacements(outline, plan.placements, plan.gap + CLEARANCE_ALLOWANCE)
      ? 'clearance'
      : null;
  verified.set(geometryKey, problem);
  if (verified.size > 32) verified.delete(verified.keys().next().value!);
  return problem ?? undefined;
}

export function validPlan(
  plan: NestingPlan,
  panel: Panel,
  config: PanelConfig,
  dot: number,
  count: number,
): boolean {
  return planProblem(plan, panel, config, dot, count) === undefined;
}
