import {
  constraintFields,
  readConstraints,
  validateConstraints,
  writeConstraints,
  updateMaterialSummary,
} from './cutting-constraints';
import type { PlanProblem } from './nesting-validation';
import { numberFieldError, setFieldError } from './field-feedback';
import type { LayoutElements, Panel, PanelConfig } from '../types';
import { designKey, type NestingPlan } from './nesting-types';
import { latticePlacements, readEditableLayout, type EditableLayout } from './lattice';
import { initializeIndividualControls, updateIndividualControls } from './individual-layout';

const input = (id: string) => document.getElementById(id) as HTMLInputElement;
const select = (id: string) => document.getElementById(id) as HTMLSelectElement;
export const patternFields = [
  'layoutCount',
  'layoutColumns',
  'layoutPitchX',
  'layoutPitchY',
  'layoutPattern',
  'layoutAngle',
  'layoutAlternate',
];
const precisePitches = new WeakMap<HTMLInputElement, { display: string; value: number }>();
const numericLabels: Record<string, string> = {
  layoutCount: 'panel count',
  layoutColumns: 'columns',
  layoutPitchX: 'horizontal center spacing',
  layoutPitchY: 'vertical center spacing',
};
export function applyEditableLayout(layout: LayoutElements, model?: EditableLayout): void {
  if (layout.editable) {
    layout.editable.current = model;
    layout.editable.error = undefined;
  }
  for (const id of patternFields) setFieldError(id);
  const mode = select('layoutMode');
  if (!mode) return;
  mode.value = model ? 'pattern' : 'grid';
  document.getElementById('gridLayoutControls')?.classList.toggle('hidden', !!model);
  document.getElementById('patternLayoutControls')?.classList.toggle('hidden', !model);
  if (!model) return;
  const individual = !!model.placements;
  const controls = document.getElementById('individualLayoutControls');
  if (controls) controls.hidden = !individual;
  const latticeControls = document.getElementById('latticeLayoutControls');
  if (latticeControls) latticeControls.hidden = individual;
  for (const id of patternFields) {
    const field = input(id);
    field.disabled = individual;
  }
  if (individual) updateIndividualControls(model);
  writeConstraints(layout, model);
  for (const [id, value] of [
    ['layoutCount', model.count],
    ['layoutColumns', model.columns],
    ['layoutPitchX', model.pitchX],
    ['layoutPitchY', model.pitchY],
    ['layoutPattern', model.pattern],
    ['layoutAngle', model.angle],
  ] as const) {
    const field = input(id);
    if (id === 'layoutPitchX' || id === 'layoutPitchY') {
      // Display a useful precision without rounding the committed geometry.
      const display = String(Number(Number(value).toFixed(3)));
      precisePitches.set(field, { display, value: Number(value) });
      field.value = display;
      field.title = `Exact spacing: ${value} mm. Editing this field replaces the exact value.`;
    } else field.value = String(value);
  }
  input('layoutAlternate').checked = model.rotateAlternates;
  const rows = document.getElementById('layoutPatternRows');
  if (rows) rows.textContent = String(Math.ceil(model.count / model.columns));
}
function readControls(layout: LayoutElements): EditableLayout {
  if (layout.editable?.current?.placements)
    return readEditableLayout({ ...layout.editable.current, ...readConstraints(layout) });
  const n = (id: string) => {
    const field = input(id),
      precise = precisePitches.get(field);
    return precise && field.value === precise.display ? precise.value : Number(field.value);
  };
  return readEditableLayout({
    count: n('layoutCount'),
    columns: n('layoutColumns'),
    pitchX: n('layoutPitchX'),
    pitchY: n('layoutPitchY'),
    pattern: Number(select('layoutPattern').value) as EditableLayout['pattern'],
    angle: Number(select('layoutAngle').value) as EditableLayout['angle'],
    rotateAlternates: input('layoutAlternate').checked,
    ...readConstraints(layout),
  });
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
    placements: model.placements ?? latticePlacements(model, model.count),
  };
  plans.set(model, { source, plan });
  return plan;
}
export function initializeEditableLayout(
  layout: LayoutElements,
  getPanel: () => { panel: Panel | null; dot: number },
  refresh: () => void,
): void {
  initializeIndividualControls(layout, () => update(), applyEditableLayout);
  const update = (constraintId?: string) => {
    const errors = validateConstraints(layout);
    updateMaterialSummary(layout);
    const notice = document.getElementById('layoutImportNotice');
    if (notice) notice.textContent = '';
    const pattern = select('layoutMode').value === 'pattern';
    if (layout.editable?.current?.placements) {
      for (const id of ['individualX', 'individualY']) {
        const error = numberFieldError(input(id), 'panel coordinate');
        if (error) errors.push(error);
      }
    }
    for (const id of patternFields) {
      const field = input(id);
      const error =
        pattern && numericLabels[id]
          ? numberFieldError(field, numericLabels[id], !id.startsWith('layoutStock'))
          : undefined;
      setFieldError(id, error);
      if (error) errors.push(error);
    }
    if (layout.editable)
      layout.editable.error =
        (pattern || layout.nesting?.active) && errors.length ? errors.join(' ') : undefined;
    if (errors.length) {
      refresh();
      return;
    }
    if (!pattern) {
      if (constraintId && layout.nesting?.active) {
        const old = layout.nesting.active,
          constraints = readConstraints(layout);
        layout.nesting.active = {
          ...old,
          gap: constraints.gap,
          ...(constraintId === 'nestingRotation' || old.rotations
            ? { rotations: constraints.rotations }
            : {}),
          stock: constraints.stock
            ? { ...constraints.stock, mode: old.stock?.mode ?? 'fit' }
            : undefined,
        };
        layout.nesting.constraintsEdited = true;
      }
      refresh();
      return;
    }
    const model = readControls(layout);
    if (layout.editable) layout.editable.current = model;
    const rows = document.getElementById('layoutPatternRows');
    if (rows) rows.textContent = String(Math.ceil(model.count / model.columns));
    refresh();
  };
  for (const id of patternFields) {
    input(id)?.addEventListener('input', () => {
      if (precisePitches.has(input(id))) input(id).removeAttribute('title');
      precisePitches.delete(input(id));
      update();
    });
    input(id)?.addEventListener('change', () => update());
  }
  for (const id of constraintFields)
    for (const event of ['input', 'change']) input(id)?.addEventListener(event, () => update(id));
  select('layoutMode')?.addEventListener('change', () => {
    if (select('layoutMode').value === 'pattern' && validateConstraints(layout).length) {
      select('layoutMode').value = layout.editable?.current ? 'pattern' : 'grid';
      return;
    }
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
        ...readConstraints(layout),
      });
    }
    refresh();
  });
}

/** Geometry feedback is separate from draft numeric errors and never changes the model. */
export function showPatternFeedback(
  layout: LayoutElements,
  {
    problem,
    plan,
    width,
    height,
    scale,
  }: {
    problem?: PlanProblem;
    plan?: NestingPlan;
    width: number;
    height: number;
    scale: number;
  },
): void {
  if (layout.editable?.error || validateConstraints(layout, 'free', false).length) return;
  const errors: Record<string, string> = {};
  if ((layout.editable?.current || layout.nesting?.constraintsEdited) && problem === 'rotations') {
    const message =
      'Panel rotations exceed the allowed policy. Change the panel rotation, alternate rotation or allowed rotations.';
    for (const id of layout.editable?.current?.placements
      ? ['individualAngle', 'nestingRotation']
      : ['layoutAngle', 'layoutAlternate', 'nestingRotation'])
      errors[id] = message;
  } else if (problem === 'clearance') {
    for (const id of layout.editable?.current?.placements
      ? ['individualX', 'individualY', 'nestingGap']
      : ['layoutPitchX', 'layoutPitchY', 'nestingGap'])
      errors[id] = layout.editable?.current?.placements
        ? 'Cut outlines overlap or are too close. Move or rotate panels, or reduce the cutting gap.'
        : 'Cut outlines overlap or are too close. Increase center spacing, change the pattern, or reduce the cutting gap.';
  }
  for (const [id, dimension, size, limit] of [
    ['nestingStockWidth', 'width', width, plan?.stock?.width],
    ['nestingStockHeight', 'height', height, plan?.stock?.height],
  ] as const) {
    if (
      (layout.editable?.current || layout.nesting?.constraintsEdited) &&
      limit !== undefined &&
      size * scale > limit + 1e-8
    )
      errors[id] =
        `This arrangement needs at least ${(Math.ceil(size * scale * 10) / 10).toFixed(1)} mm ${dimension} at the current export scale and padding. Increase stock ${dimension} or reduce scale, padding or spacing.`;
  }
  for (const id of [
    ...patternFields,
    ...constraintFields,
    'individualX',
    'individualY',
    'individualAngle',
  ])
    setFieldError(id, errors[id]);
}
