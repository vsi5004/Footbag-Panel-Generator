import type { JobSnapshot } from './gcode-job';
import { generateGcode } from './gcode';
import { parseGcode } from './gcode-preview';
import { prepareGcodePreview } from './gcode-preview-data';

/** Pure worker entry, also used by regression tests and benchmarks. */
export function runGcodeJob(snapshot: JobSnapshot) {
  const { panel, opts, scalePercent, settings, designSettings } = snapshot.input;
  const result = generateGcode(panel, opts, scalePercent, settings, designSettings);
  const preview = parseGcode(result.code);
  return {
    code: result.code,
    sheet: result.sheet,
    cutCount: result.paths.length,
    panelCount: result.paths.filter((p) => p.kind === 'panel').length,
    cutDistance: preview.cutDistance,
    travelDistance: preview.travelDistance,
    warnings: preview.warnings,
    preview: prepareGcodePreview(result.sheet, preview.moves),
  };
}
export type GcodeJobResult = ReturnType<typeof runGcodeJob>;
