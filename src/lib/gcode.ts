import ClipperLib from 'clipper-lib';
import type { Panel, Point } from '../types';
import { geometry } from './geometry';
import { manualPlacements, measureLayoutSvg, type LayoutSvgOptions } from './layout';
import { checkPlacements, flattenOutline, isSimple } from './nesting-geometry';
import { bounds, transform } from './nesting-types';
import { readGcodeSettings, type GcodeSettings } from './gcode-settings';
import { CutIndex } from './gcode-routing';
import type { SettingsData } from './state';

export interface CutPath {
  points: Point[];
  closed: boolean;
  panel: number;
  kind: 'stitch' | 'panel';
}
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const gcodeNumber = (n: number) => Number(n.toFixed(5)).toString();

/** SVG circular arcs flattened by maximum chord length in physical output units. */
export function flattenCutOutline(path: string, length: number): Point[] {
  const points: Point[] = [];
  let previous: Point | undefined;
  for (const match of path.matchAll(/([MLA])\s*([^MLAZ]+)/g)) {
    const v = match[2]
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const end = { x: v[v.length - 2], y: v[v.length - 1] };
    if (!Number.isFinite(end.x + end.y)) throw new Error('Invalid panel outline');
    if (match[1] === 'A' && previous) {
      const radius = Math.max(v[0], distance(end, previous) / 2);
      const arc = geometry.getSvgCircularArcParams(
        previous,
        end,
        radius,
        v[3] as 0 | 1,
        v[4] as 0 | 1,
      );
      if (!arc.valid) throw new Error('Invalid panel arc');
      const count = Math.max(1, Math.ceil((Math.abs(arc.dAng) * radius) / length));
      if (count > 100000)
        throw new Error('Curve has too many segments; increase curve segment length');
      for (let i = 1; i < count; i++) {
        const angle = arc.angA + (arc.dAng * i) / count;
        points.push({
          x: arc.c.x + radius * Math.cos(angle),
          y: arc.c.y + radius * Math.sin(angle),
        });
      }
    }
    if (!previous || distance(points[points.length - 1], end) > 1e-8) points.push(end);
    previous = end;
  }
  if (points.length > 1 && distance(points[0], points[points.length - 1]) < 1e-8) points.pop();
  if (points.length < 3) throw new Error('Invalid panel outline');
  return points;
}

/** Clipper handles concave star roots as well as convex and curved panels. */
export function offsetOutline(points: Point[], amount: number): Point[] {
  if (!amount) return points;
  const scale = 100000;
  const path = points.map((p) => ({ X: Math.round(p.x * scale), Y: Math.round(p.y * scale) }));
  if (!ClipperLib.Clipper.Orientation(path)) path.reverse();
  const offset = new ClipperLib.ClipperOffset(2, 0.001 * scale);
  offset.AddPath(path, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
  const result: ClipperLib.Paths = [];
  offset.Execute(result, amount * scale);
  if (result.length !== 1 || result[0].length < 3)
    throw new Error('Kerf produces an invalid panel outline');
  return result[0].map((p) => ({ x: p.X / scale, y: p.Y / scale }));
}

/** Deterministic nearest eligible cut; closed contours rotate entry, slits may reverse.
 * Nearest-start selection and Clipper offsets follow common CAM techniques;
 * see OpenBuilds CAM's toolpath worker. No CAM source is copied.
 * The selected policy controls whether unfinished stitches block panel release.
 */
export function orderCuts(paths: CutPath[], order: GcodeSettings['cutOrder']): CutPath[] {
  const remaining = new Map<number, number>();
  for (const p of paths)
    if (p.kind === 'stitch') remaining.set(p.panel, (remaining.get(p.panel) ?? 0) + 1);
  const result: CutPath[] = [];
  let cursor: Point = { x: 0, y: 0 },
    stitches = paths.filter((p) => p.kind === 'stitch').length;
  let activePanel: number | undefined;
  const panels = new Map<number, number>();
  paths.forEach((p, i) => {
    if (p.kind === 'panel') panels.set(p.panel, i);
  });
  const index = new CutIndex(
    paths,
    paths.map(
      (p) =>
        order === 'optimized' ||
        p.kind === 'stitch' ||
        (order === 'panel-by-panel' ? !remaining.get(p.panel) : !stitches),
    ),
  );
  while (result.length < paths.length) {
    const best = index.nearest(
      cursor,
      (i) =>
        order !== 'panel-by-panel' || activePanel === undefined || paths[i].panel === activePanel,
    );
    if (!best) throw new Error('Unable to order cutting paths');
    const selected = paths[best.path],
      start = best.start;
    index.enable(best.path, false);
    if (order === 'panel-by-panel')
      activePanel = selected.kind === 'panel' ? undefined : selected.panel;
    const points = selected.closed
      ? [...selected.points.slice(start), ...selected.points.slice(0, start)]
      : start
        ? selected.points.slice().reverse()
        : selected.points;
    result.push({ ...selected, points });
    cursor = points[selected.closed ? 0 : points.length - 1];
    if (selected.kind === 'stitch') {
      stitches--;
      remaining.set(selected.panel, remaining.get(selected.panel)! - 1);
      if (order === 'all-stitches-first' && !stitches)
        for (const i of panels.values()) index.enable(i, true);
      if (order === 'panel-by-panel' && !remaining.get(selected.panel))
        index.enable(panels.get(selected.panel)!, true);
    }
  }
  return result;
}

export function generateGcode(
  panel: Panel,
  opts: LayoutSvgOptions,
  scalePercent: number,
  raw: GcodeSettings,
  designSettings?: SettingsData,
) {
  const settings = readGcodeSettings(raw),
    scale = scalePercent / 100;
  if (settings.includeSettings && !designSettings)
    throw new Error('Panel settings are required for detailed GCode header comments');
  if (!(scale >= 0.01 && scale <= 10)) throw new Error('Invalid export scale');
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
      const radius = (diameter - settings.kerf) / 2;
      const center = { x: hole.x * scale, y: hole.y * scale };
      const points: Point[] = [];
      if (settings.stitchMode === 'slit') {
        points.push({ x: center.x - radius, y: center.y }, { x: center.x + radius, y: center.y });
      } else {
        const count = Math.max(12, Math.ceil((2 * Math.PI * radius) / settings.segmentLength));
        for (let j = 0; j < count; j++)
          points.push({
            x: center.x + radius * Math.cos((2 * Math.PI * j) / count),
            y: center.y + radius * Math.sin((2 * Math.PI * j) / count),
          });
      }
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
  const ordered = orderCuts(paths, settings.cutOrder),
    power = (settings.powerMax * settings.cutPower) / 100;
  const header: string[] = [];
  if (settings.includeSettings) {
    const panelSettings: Record<string, unknown> = { ...designSettings };
    for (const key of ['$schema', 'version', 'gcode', 'layout', 'export', 'showGrid'])
      delete panelSettings[key];
    const layoutSettings = { ...designSettings?.layout };
    delete layoutSettings.optimized;
    delete layoutSettings.showGrid;
    // A rejected search goal must not change the header of the accepted cutting job.
    delete layoutSettings.nesting;
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
  const lines = [
    '; Footbag Panel Generator',
    `; Sheet ${gcodeNumber(size.width * scale)} x ${gcodeNumber(size.height * scale)} mm; scale ${scalePercent}%`,
    `; Origin: ${settings.origin}${settings.origin === 'center' ? ' of cut design' : ' of sheet'}; X right, Y up`,
    ...header,
    settings.startCode.trim(),
    '; Generated cuts (mm, absolute, feed per minute, dynamic laser)',
    'G21',
    'G90',
    'G94',
    'M4 S0',
  ];
  for (const path of ordered) {
    lines.push(
      `; Panel ${path.panel + 1} ${path.kind}`,
      'S0',
      `G0 X${gcodeNumber(path.points[0].x)} Y${gcodeNumber(path.points[0].y)}`,
    );
    const points = path.closed ? [...path.points.slice(1), path.points[0]] : path.points.slice(1);
    points.forEach((p, i) =>
      lines.push(
        `G1 X${gcodeNumber(p.x)} Y${gcodeNumber(p.y)}${i === 0 ? ` S${gcodeNumber(power)} F${gcodeNumber(settings.cutSpeed)}` : ''}`,
      ),
    );
  }
  lines.push('S0', 'M5', settings.endCode.trim());
  return {
    code: lines.filter(Boolean).join('\n') + '\n',
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
