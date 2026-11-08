import type { Panel, PanelConfig } from '../types';
import { flattenOutline, checkPlacements, isSimple } from './nesting-geometry';
import { designKey, CLEARANCE_ALLOWANCE, type NestingPlan } from './nesting-types';

const verified = new WeakMap<NestingPlan, string>();
export function validPlan(
  plan: NestingPlan,
  panel: Panel,
  config: PanelConfig,
  dot: number,
  count: number,
): boolean {
  const key = designKey(config, dot, count);
  if (plan.source !== key || (plan.stock?.mode !== 'capacity' && plan.placements.length !== count))
    return false;
  if (
    plan.rotations &&
    plan.placements.some(
      (at) =>
        at.flipY ||
        (plan.rotations === 'none' && at.angle !== 0) ||
        (plan.rotations === 'half' && at.angle % 180 !== 0),
    )
  )
    return false;
  if (verified.get(plan) === key) return true;
  const outline = flattenOutline(panel.outlinePath);
  if (
    !isSimple(outline) ||
    !checkPlacements(outline, plan.placements, plan.gap + CLEARANCE_ALLOWANCE)
  )
    return false;
  verified.set(plan, key);
  return true;
}
