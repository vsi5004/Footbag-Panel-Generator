import type { DesignSettings } from './gcode-types';
import type { LayoutSvgOptions } from './layout';
import type { Placement } from './nesting-types';
/** Normalize once for both cache identity and serialized header comments. */
export function normalizeGcodeMetadata(design: DesignSettings): DesignSettings {
  const panelSettings: Record<string, unknown> = { ...design };
  for (const key of ['$schema', 'version', 'gcode', 'layout', 'export', 'showGrid'])
    delete panelSettings[key];
  const layoutSettings = { ...design.layout };
  delete layoutSettings.optimized;
  delete layoutSettings.showGrid;
  // Rejected search preferences cannot change the accepted cutting job.
  delete layoutSettings.nesting;
  return { ...panelSettings, layout: layoutSettings };
}

export function gcodeHeader(
  designSettings: DesignSettings | undefined,
  opts: LayoutSvgOptions,
  placements: Placement[],
  scalePercent: number,
  size: { width: number; height: number },
  diameter: number,
  includeSettings: boolean,
): string[] {
  const scale = scalePercent / 100;
  const header: string[] = [];
  if (includeSettings) {
    const { layout: layoutSettings, ...panelSettings } = normalizeGcodeMetadata(designSettings!);
    const metadata = {
      panelSettings,
      layout: {
        mode: designSettings?.layout.editable
          ? 'editable pattern'
          : opts.optimized
            ? 'accepted optimized layout'
            : 'grid',
        settings: layoutSettings,
        panelCount: placements.length,
        exportScalePercent: scalePercent,
        sheetSizeMm: { width: size.width * scale, height: size.height * scale },
        holeDiameterMm: diameter,
        paddingAt100PercentMm: opts.padding ?? 10,
        ...(!opts.optimized
          ? {
              grid: {
                rows: opts.rows,
                cols: opts.cols,
                horizontalSpacingMm: opts.hSpace,
                verticalSpacingMm: opts.vSpace,
                invertOddColumns: opts.invertOdd,
                nestingVerticalOffsetMm: opts.nestingVerticalOffset,
              },
            }
          : {}),
        placementsAt100Percent: placements,
      },
    };
    header.push(
      '; Panel settings and layout details (base design in mm; physical output dimensions noted)',
      ...JSON.stringify(metadata, null, 2)
        .split('\n')
        .map((line) => `; ${line}`),
      '; End panel settings and layout details',
    );
  }
  return header;
}
