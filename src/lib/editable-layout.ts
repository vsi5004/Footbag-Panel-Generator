import type { LayoutElements, Panel, PanelConfig } from '../types';
import { designKey, type NestingPlan } from './nesting-types';
import { latticePlacements, type EditableLayout } from './lattice';

const input = (id: string) => document.getElementById(id) as HTMLInputElement;
const select = (id: string) => document.getElementById(id) as HTMLSelectElement;
const fields = [
  'layoutCount',
  'layoutColumns',
  'layoutPitchX',
  'layoutPitchY',
  'layoutPattern',
  'layoutAngle',
  'layoutAlternate',
  'layoutRotations',
  'layoutGap',
  'layoutStockWidth',
  'layoutStockHeight',
];
export function applyEditableLayout(layout: LayoutElements, model?: EditableLayout): void {
  if (layout.editable) {
    layout.editable.current = model;
    layout.editable.error = undefined;
  }
  const mode = select('layoutMode');
  if (!mode) return;
  mode.value = model ? 'pattern' : 'grid';
  document.getElementById('gridLayoutControls')?.classList.toggle('hidden', !!model);
  document.getElementById('patternLayoutControls')?.classList.toggle('hidden', !model);
  if (!model) return;
  for (const [id, value] of [
    ['layoutCount', model.count],
    ['layoutColumns', model.columns],
    ['layoutPitchX', model.pitchX],
    ['layoutPitchY', model.pitchY],
    ['layoutPattern', model.pattern],
    ['layoutAngle', model.angle],
    ['layoutRotations', model.rotations],
    ['layoutGap', model.gap],
    ['layoutStockWidth', model.stock?.width ?? ''],
    ['layoutStockHeight', model.stock?.height ?? ''],
  ] as const)
    input(id).value = String(value);
  input('layoutAlternate').checked = model.rotateAlternates;
  const rows = document.getElementById('layoutPatternRows');
  if (rows) rows.textContent = String(Math.ceil(model.count / model.columns));
}
function readControls(): EditableLayout {
  const n = (id: string, min: number, max: number, integer = false) => {
    const value = Number(input(id).value);
    const result = Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
    return integer ? Math.round(result) : result;
  };
  const width = n('layoutStockWidth', 0, 10000),
    height = n('layoutStockHeight', 0, 10000);
  return {
    count: n('layoutCount', 1, 144, true),
    columns: n('layoutColumns', 1, 144, true),
    pitchX: n('layoutPitchX', 0, 10000),
    pitchY: n('layoutPitchY', 0, 10000),
    pattern: Number(select('layoutPattern').value) as EditableLayout['pattern'],
    angle: Number(select('layoutAngle').value) as EditableLayout['angle'],
    rotateAlternates: input('layoutAlternate').checked,
    rotations: select('layoutRotations').value as EditableLayout['rotations'],
    gap: n('layoutGap', 0, 20),
    ...(width >= 1
      ? { stock: { mode: 'fit' as const, width, ...(height >= 1 ? { height } : {}) } }
      : {}),
  };
}
const plans = new WeakMap<EditableLayout, { source: string; plan: NestingPlan }>();
export function editablePlan(model: EditableLayout, config: PanelConfig, dot: number): NestingPlan {
  const source = designKey(config, dot, model.count);
  const cached = plans.get(model);
  if (cached?.source === source) return cached.plan;
  const plan: NestingPlan = {
    version: 1,
    source,
    gap: model.gap,
    rotations: model.rotations,
    ...(model.stock ? { stock: model.stock } : {}),
    placements: latticePlacements(model, model.count),
  };
  plans.set(model, { source, plan });
  return plan;
}
export function initializeEditableLayout(
  layout: LayoutElements,
  getPanel: () => { panel: Panel | null; dot: number },
  refresh: () => void,
): void {
  const update = () => {
    if (select('layoutMode').value !== 'pattern') return;
    const invalid =
      fields.some((id) => {
        const field = input(id);
        return (
          field.type === 'number' &&
          (!field.validity.valid ||
            (field.value === '' && !['layoutStockWidth', 'layoutStockHeight'].includes(id)))
        );
      }) ||
      (input('layoutStockHeight').value !== '' && input('layoutStockWidth').value === '');
    if (layout.editable)
      layout.editable.error = invalid
        ? 'Enter valid pattern settings; stock height requires a stock width.'
        : undefined;
    if (invalid) {
      refresh();
      return;
    }
    const model = readControls();
    if (layout.editable) layout.editable.current = model;
    const rows = document.getElementById('layoutPatternRows');
    if (rows) rows.textContent = String(Math.ceil(model.count / model.columns));
    refresh();
  };
  for (const id of fields) {
    input(id)?.addEventListener('input', update);
    input(id)?.addEventListener('change', update);
  }
  select('layoutMode')?.addEventListener('change', () => {
    if (layout.nesting) layout.nesting.active = undefined;
    if (select('layoutMode').value === 'grid') applyEditableLayout(layout);
    else {
      const { panel, dot } = getPanel();
      applyEditableLayout(layout, {
        count: Number(layout.pageRows?.value ?? 3) * Number(layout.pageCols?.value ?? 3),
        columns: Number(layout.pageCols?.value ?? 3),
        pitchX: Math.max(
          0,
          (panel?.bounds.width ?? 50) - 20 + dot + Number(layout.pageHSpaceNumber?.value ?? 0),
        ),
        pitchY: Math.max(
          0,
          (panel?.bounds.height ?? 50) - 20 + dot + Number(layout.pageVSpace?.value ?? 1),
        ),
        pattern: 0,
        angle: 0,
        rotateAlternates: false,
        rotations: 'half',
        gap: 0,
      });
    }
    refresh();
  });
}
