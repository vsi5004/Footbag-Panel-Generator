import { gcodeNumber, type CutPath } from './gcode-types';
import type { GcodeSettings } from './gcode-settings';
export function serializeGcode(
  ordered: CutPath[],
  sheet: { width: number; height: number },
  scalePercent: number,
  settings: GcodeSettings,
  header: string[],
): string {
  const power = (settings.powerMax * settings.cutPower) / 100;
  const lines = [
    '; Footbag Panel Generator',
    `; Sheet ${gcodeNumber(sheet.width)} x ${gcodeNumber(sheet.height)} mm; scale ${scalePercent}%`,
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
  return lines.filter(Boolean).join('\n') + '\n';
}
