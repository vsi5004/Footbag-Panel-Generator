import type { Panel, Point } from '../types';
import { manualPlacements, measureLayoutSvg, type LayoutSvgOptions } from './layout';
import { checkPlacements, flattenOutline, isSimple } from './nesting-geometry';
import { bounds, transform } from './nesting-types';
import { readGcodeSettings, type GcodeSettings } from './gcode-settings';
import { orderCuts } from './gcode-routing';
import { flattenCutOutline, offsetOutline } from './gcode-geometry';
import type { CutPath, DesignSettings } from './gcode-types';
import { gcodeHeader } from './gcode-metadata';
import { serializeGcode } from './gcode-serialize';
import { validateStartCode } from './gcode-dialect';
export { orderCuts } from './gcode-routing';
export { flattenCutOutline, offsetOutline } from './gcode-geometry';
export { gcodeNumber, type CutPath } from './gcode-types';

export function generateGcode(
  panel: Panel,
  opts: LayoutSvgOptions,
  scalePercent: number,
  raw: GcodeSettings,
  designSettings?: DesignSettings,
) {
  const settings = readGcodeSettings(raw),
    scale = scalePercent / 100;
  if (settings.includeSettings && !designSettings)
    throw new Error('Panel settings are required for detailed GCode header comments');
  if (!(scale >= 0.01 && scale <= 10)) throw new Error('Invalid export scale');
  validateStartCode(settings.startCode);
  const placements = opts.optimized?.placements ?? manualPlacements(panel, opts);
  const coarse = flattenOutline(panel.outlinePath, 0.002);
  if (!isSimple(coarse)) throw new Error('Panel outline crosses itself');
  if (!checkPlacements(coarse, placements, settings.kerf / scale + 0.005))
    throw new Error(
      'Panels overlap or have insufficient space for the laser kerf. Increase layout spacing.',
    );
  const diameter = opts.dotDiameter * scale;
  if (panel.stitches.length && diameter - settings.kerf < 0.0001)
    throw new Error(
      'Stitch-hole diameter must exceed the laser kerf. Increase hole diameter or reduce kerf.',
    );
  const outline = offsetOutline(
    flattenCutOutline(panel.outlinePath, settings.segmentLength / scale).map((p) => ({
      x: p.x * scale,
      y: p.y * scale,
    })),
    settings.kerf / 2,
  );
  if (
    !checkPlacements(
      outline,
      placements.map((at) => ({ ...at, x: at.x * scale, y: at.y * scale })),
      0.00001,
    )
  )
    throw new Error('Kerf-compensated panel paths touch or cross. Increase layout spacing.');
  const size = measureLayoutSvg(panel, opts);
  const minX = opts.optimized
    ? 'minX' in size
      ? (size.minX as number)
      : 0
    : -(opts.padding ?? 10);
  const minY = opts.optimized
    ? 'minY' in size
      ? (size.minY as number)
      : 0
    : -(opts.padding ?? 10) +
      (opts.invertOdd && opts.nestingVerticalOffset < 0 ? opts.nestingVerticalOffset : 0);
  // Every stitch has the same physical cut shape; reuse its sampled offsets.
  const radius = (diameter - settings.kerf) / 2;
  const count = Math.max(12, Math.ceil((2 * Math.PI * radius) / settings.segmentLength));
  const stitchOffsets =
    settings.stitchMode === 'slit'
      ? [
          { x: -radius, y: 0 },
          { x: radius, y: 0 },
        ]
      : Array.from({ length: count }, (_, j) => ({
          x: radius * Math.cos((2 * Math.PI * j) / count),
          y: radius * Math.sin((2 * Math.PI * j) / count),
        }));
  const paths: CutPath[] = [];
  for (let i = 0; i < placements.length; i++) {
    const at = { ...placements[i], x: placements[i].x * scale, y: placements[i].y * scale };
    // First build in lower-left sheet coordinates for physical bounds checks.
    const place = (p: Point) => {
      const q = transform(p, at);
      return { x: q.x - minX * scale, y: (minY + size.height) * scale - q.y };
    };
    paths.push({ panel: i, kind: 'panel', closed: true, points: outline.map(place) });
    for (const hole of panel.stitches) {
      const center = { x: hole.x * scale, y: hole.y * scale };
      const points = stitchOffsets.map((p) => ({ x: center.x + p.x, y: center.y + p.y }));
      paths.push({
        panel: i,
        kind: 'stitch',
        closed: settings.stitchMode === 'outline',
        points: points.map(place),
      });
    }
  }
  for (const p of paths)
    for (const q of p.points) {
      if (
        !Number.isFinite(q.x + q.y) ||
        q.x < -0.00001 ||
        q.y < -0.00001 ||
        q.x > size.width * scale + 0.00001 ||
        q.y > size.height * scale + 0.00001
      )
        throw new Error('Kerf-compensated cuts exceed the sheet. Increase layout padding.');
    }
  const design = bounds(paths.flatMap((p) => p.points));
  const origin = {
    x:
      settings.origin === 'center'
        ? (design.minX + design.maxX) / 2
        : settings.origin.endsWith('right')
          ? size.width * scale
          : 0,
    y:
      settings.origin === 'center'
        ? (design.minY + design.maxY) / 2
        : settings.origin.startsWith('upper')
          ? size.height * scale
          : 0,
  };
  for (const path of paths)
    for (const p of path.points) {
      p.x -= origin.x;
      p.y -= origin.y;
    }
  const ordered = orderCuts(paths, settings.cutOrder);
  const header = gcodeHeader(
    designSettings,
    opts,
    placements,
    scalePercent,
    size,
    diameter,
    settings.includeSettings,
  );
  return {
    code: serializeGcode(
      ordered,
      { width: size.width * scale, height: size.height * scale },
      scalePercent,
      settings,
      header,
    ),
    paths: ordered,
    sheet: {
      width: size.width * scale,
      height: size.height * scale,
      minX: -origin.x,
      minY: -origin.y,
    },
    extent: bounds(paths.flatMap((p) => p.points)),
  };
}
