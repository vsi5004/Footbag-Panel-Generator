import controls from '../../schema/controls.json';
import { utils } from './utils';

export const SETTINGS = controls;
export type SettingName = keyof typeof SETTINGS;

/** Normalize a numeric setting; geometry may supply a tighter dynamic maximum. */
export function normalizeSetting(name: SettingName, value: unknown, max?: number): number {
  const definition = SETTINGS[name];
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? definition.step === '1'
          ? Number.parseInt(value, 10)
          : Number.parseFloat(value)
        : NaN;
  const number = Number.isFinite(parsed) ? parsed : definition.default;
  return utils.clamp(number, definition.min, max ?? definition.max);
}
