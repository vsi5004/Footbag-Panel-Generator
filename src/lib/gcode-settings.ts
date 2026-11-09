export interface GcodeSettings {
  startCode: string;
  endCode: string;
  powerMax: number;
  cutPower: number;
  kerf: number;
  cutSpeed: number;
  segmentLength: number;
  stitchMode: 'slit' | 'outline';
  cutOrder: 'all-stitches-first' | 'panel-by-panel' | 'optimized';
  origin: 'lower-left' | 'lower-right' | 'upper-left' | 'upper-right' | 'center';
  includeSettings: boolean;
}

export const GCODE_DEFAULTS: GcodeSettings = {
  startCode:
    'G21         ; Set units to mm\nG90         ; Absolute positioning\nM4 S0       ; Enable Laser/Spindle (0 power)',
  endCode: 'M5          ; Disable Laser/Spindle\nM2          ; End',
  powerMax: 1000,
  cutPower: 100,
  kerf: 0.1,
  cutSpeed: 1000,
  segmentLength: 0.2,
  stitchMode: 'slit',
  cutOrder: 'all-stitches-first',
  origin: 'lower-left',
  includeSettings: false,
};

export const GCODE_LIMITS = {
  powerMax: [0.001, 1000000],
  cutPower: [0, 100],
  kerf: [0, 10],
  cutSpeed: [1, 100000],
  segmentLength: [0.01, 5],
} as const;

/** Strict validation happens before any imported design controls are changed. */
export function readGcodeSettings(value: unknown): GcodeSettings {
  if (value === undefined) return { ...GCODE_DEFAULTS };
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid GCode settings');
  const raw = value as Record<string, unknown>;
  const result = { ...GCODE_DEFAULTS, ...raw } as GcodeSettings;
  if (typeof result.includeSettings !== 'boolean') throw new Error('Invalid GCode includeSettings');
  if (!['lower-left', 'lower-right', 'upper-left', 'upper-right', 'center'].includes(result.origin))
    throw new Error('Invalid GCode origin');
  for (const [key, [min, max]] of Object.entries(GCODE_LIMITS)) {
    const v = result[key as keyof typeof GCODE_LIMITS];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max)
      throw new Error(`Invalid GCode ${key} (${min}–${max})`);
  }
  for (const key of ['startCode', 'endCode'] as const)
    if (
      typeof result[key] !== 'string' ||
      result[key].length > 20000 ||
      /[^\x09\x0a\x0d\x20-\x7e]/.test(result[key])
    )
      throw new Error(`Invalid GCode ${key}: use ASCII text, up to 20,000 characters`);
  if (
    !['slit', 'outline'].includes(result.stitchMode) ||
    !['all-stitches-first', 'panel-by-panel', 'optimized'].includes(result.cutOrder)
  )
    throw new Error('Invalid GCode stitch settings');
  return Object.fromEntries(
    Object.keys(GCODE_DEFAULTS).map((key) => [key, result[key as keyof GcodeSettings]]),
  ) as unknown as GcodeSettings;
}

export function collectGcodeSettings(): GcodeSettings {
  const values: Record<string, unknown> = {};
  for (const key of Object.keys(GCODE_DEFAULTS)) {
    const el = document.getElementById(`gcode-${key}`) as
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (!el) continue;
    values[key] =
      typeof GCODE_DEFAULTS[key as keyof GcodeSettings] === 'boolean'
        ? (el as HTMLInputElement).checked
        : key in GCODE_LIMITS
          ? el.value.trim()
            ? Number(el.value)
            : NaN
          : el.value;
  }
  return readGcodeSettings(values);
}

export function applyGcodeSettings(value?: GcodeSettings): void {
  const settings = readGcodeSettings(value);
  for (const [key, v] of Object.entries(settings)) {
    const el = document.getElementById(`gcode-${key}`) as HTMLInputElement | null;
    if (el) {
      if (typeof v === 'boolean') el.checked = v;
      else el.value = String(v);
    }
  }
}
