import type { Panel, PanelConfig } from '../types';
import { flattenOutline, checkPlacements, isSimple } from './nesting-geometry';
import { designKey, CLEARANCE_ALLOWANCE, type NestingPlan } from './nesting-types';

const verified = new WeakMap<NestingPlan, string>();
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
  if (verified.get(plan) === key) return undefined;
  const outline = flattenOutline(panel.outlinePath);
  if (!isSimple(outline)) return 'outline';
  if (!checkPlacements(outline, plan.placements, plan.gap + CLEARANCE_ALLOWANCE))
    return 'clearance';
  verified.set(plan, key);
  return undefined;
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
