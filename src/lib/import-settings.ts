import { readEditableLayout, readLattice } from './lattice';
import { readStock, readRotations, readNestingPreferences } from './stock-nesting';
import schema from '../../schema/settings.schema.json';
import { SETTINGS } from './settings';
import type { SettingsData } from './state';

export type ImportedSettings = Partial<Omit<SettingsData, 'hex' | 'layout'>> & {
  hex?: Partial<SettingsData['hex']>;
  layout?: Partial<SettingsData['layout']>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Validate a complete import before touching controls; keep historical partial files usable. */
export function readImportedSettings(value: unknown): ImportedSettings {
  if (!isObject(value)) throw new Error('Settings must be an object');
  const result = { ...value };
  const known = Object.keys(schema.properties).filter(
    (key) => key !== '$schema' && key !== 'version',
  );
  if (!known.some((key) => key in result)) throw new Error('No design settings found');
  if ('version' in result && result.version !== 1 && result.version !== 2)
    throw new Error('Unsupported settings version');

  for (const key of ['hex', 'layout', 'export']) {
    if (key in result) {
      const section = result[key];
      if (!isObject(section)) throw new Error(`Invalid ${key} settings`);
      result[key] = { ...section };
    }
  }

  for (const definition of Object.values(SETTINGS)) {
    const path = definition.path.split('.');
    const parent = path.length === 1 ? result : result[path[0]];
    const key = path[path.length - 1];
    if (!isObject(parent) || !(key in parent)) continue;
    const raw = parent[key];
    const number =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string' && raw.trim() !== ''
          ? Number(raw)
          : NaN;
    if (!Number.isFinite(number)) throw new Error(`Invalid ${definition.path}`);
    parent[key] = number;
  }

  if ('shape' in result && !schema.properties.shape.enum.includes(result.shape as number)) {
    throw new Error('Unsupported shape');
  }
  const hex = result.hex;
  if (
    isObject(hex) &&
    'type' in hex &&
    !schema.properties.hex.properties.type.enum.includes(hex.type as string)
  ) {
    throw new Error('Unsupported hexagon type');
  }
  for (const key of ['curved', 'showHoles', 'showGrid', 'cornerStitchSpacing']) {
    if (key in result && typeof result[key] !== 'boolean') throw new Error(`Invalid ${key}`);
  }
  const layout = result.layout;
  if (isObject(layout)) {
    for (const key of ['invert', 'showGrid']) {
      if (key in layout && typeof layout[key] !== 'boolean')
        throw new Error(`Invalid layout.${key}`);
    }
  }
  if (isObject(layout) && 'editable' in layout) {
    if ('optimized' in layout) throw new Error('Conflicting layout modes');
    layout.editable = readEditableLayout(layout.editable);
  }
  if (isObject(layout) && 'nesting' in layout)
    layout.nesting = readNestingPreferences(layout.nesting);
  if (isObject(layout) && 'optimized' in layout) {
    const plan = layout.optimized;
    if (
      !isObject(plan) ||
      plan.version !== 1 ||
      typeof plan.source !== 'string' ||
      plan.source.length > 2048 ||
      typeof plan.gap !== 'number' ||
      !Number.isFinite(plan.gap) ||
      plan.gap < 0 ||
      plan.gap > 20 ||
      !Array.isArray(plan.placements) ||
      plan.placements.length < 1 ||
      plan.placements.length > 144
    )
      throw new Error('Invalid optimized layout');
    for (const at of plan.placements) {
      if (
        !isObject(at) ||
        typeof at.x !== 'number' ||
        typeof at.y !== 'number' ||
        !Number.isFinite(at.x) ||
        !Number.isFinite(at.y) ||
        Math.abs(at.x) > 100000 ||
        Math.abs(at.y) > 100000 ||
        ![0, 90, 180, 270].includes(at.angle as number) ||
        ('flipY' in at && typeof at.flipY !== 'boolean')
      )
        throw new Error('Invalid panel placement');
    }
    layout.optimized = {
      version: 1,
      source: plan.source,
      gap: plan.gap,
      placements: plan.placements.map((at) => ({ ...at })),
      ...('lattice' in plan ? { lattice: readLattice(plan.lattice) } : {}),
      ...('rotations' in plan ? { rotations: readRotations(plan.rotations) } : {}),
      ...('stock' in plan ? { stock: readStock(plan.stock) } : {}),
    };
  }
  return result as ImportedSettings;
}
