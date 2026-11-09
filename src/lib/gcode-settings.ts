import { GCODE_DEFINITIONS, type GcodeSettings } from './gcode-definitions';
export type { GcodeSettings } from './gcode-definitions';
export const GCODE_DEFAULTS = Object.fromEntries(
  Object.entries(GCODE_DEFINITIONS).map(([key, d]) => [key, d.default]),
) as unknown as GcodeSettings;
type Definitions = typeof GCODE_DEFINITIONS;
type NumericGcodeKey = {
  [K in keyof Definitions]: Definitions[K] extends { type: 'number' } ? K : never;
}[keyof Definitions];
export const GCODE_LIMITS = Object.fromEntries(
  Object.entries(GCODE_DEFINITIONS).flatMap(([key, d]) =>
    'minimum' in d ? [[key, [d.minimum, d.maximum]]] : [],
  ),
) as unknown as Record<NumericGcodeKey, readonly [number, number]>;

/** Strict validation happens before any imported design controls are changed. */
export function readGcodeSettings(value: unknown): GcodeSettings {
  if (value === undefined) return { ...GCODE_DEFAULTS };
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid GCode settings');
  const result = { ...GCODE_DEFAULTS, ...value } as GcodeSettings;
  for (const [key, d] of Object.entries(GCODE_DEFINITIONS)) {
    const v = result[key as keyof GcodeSettings];
    if ('enum' in d) {
      if (!(d.enum as readonly unknown[]).includes(v)) throw new Error(`Invalid GCode ${key}`);
    } else if (
      typeof v !== d.type ||
      ('minimum' in d &&
        (typeof v !== 'number' || !Number.isFinite(v) || v < d.minimum || v > d.maximum))
    ) {
      throw new Error(`Invalid GCode ${key}`);
    } else if (
      'maxLength' in d &&
      (typeof v !== 'string' || v.length > d.maxLength || /[^\x09\x0a\x0d\x20-\x7e]/.test(v))
    ) {
      throw new Error(`Invalid GCode ${key}: use ASCII text, up to ${d.maxLength} characters`);
    }
  }
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
