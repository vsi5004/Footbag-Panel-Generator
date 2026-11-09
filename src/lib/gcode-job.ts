import { normalizeGcodeMetadata } from './gcode-metadata';
import type { Panel } from '../types';
import type { LayoutSvgOptions } from './layout';
import { readGcodeSettings, type GcodeSettings } from './gcode-settings';
import type { DesignSettings } from './gcode-types';
import { validateStartCode } from './gcode-dialect';

export interface CutLayout {
  panel: Panel;
  opts: LayoutSvgOptions;
}
interface JobInput extends CutLayout {
  scalePercent: number;
  settings: GcodeSettings;
  designSettings?: DesignSettings;
}
export interface JobSnapshot {
  readonly key: string;
  readonly input: Readonly<JobInput>;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
/** Copy only accepted cut inputs. Preview grids and optimizer search preferences
 * cannot affect the cache key, including when detailed header comments are enabled.
 */
export function createJobSnapshot(
  layout: CutLayout | undefined,
  scalePercent: number,
  raw: GcodeSettings,
  designSettings?: DesignSettings,
): JobSnapshot {
  if (!layout) throw new Error('Fix the lasercutter layout before generating GCode.');
  const settings = readGcodeSettings(raw);
  validateStartCode(settings.startCode);
  if (!Number.isFinite(scalePercent) || scalePercent < 1 || scalePercent > 1000)
    throw new Error('Invalid export scale');
  let metadata: DesignSettings | undefined;
  if (settings.includeSettings) {
    if (!designSettings)
      throw new Error('Panel settings are required for detailed GCode header comments');
    metadata = normalizeGcodeMetadata(designSettings);
  }
  const input: JobInput = structuredClone({
    panel: layout.panel,
    opts: { ...layout.opts, showGrid: false },
    scalePercent,
    settings,
    ...(metadata ? { designSettings: metadata } : {}),
  });
  // Accepted placement coordinates define the job; solver diagnostics do not.
  if (input.opts.optimized) input.opts.optimized = { placements: input.opts.optimized.placements };
  return freeze({ key: JSON.stringify(input), input });
}
