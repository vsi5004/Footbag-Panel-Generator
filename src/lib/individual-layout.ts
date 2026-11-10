import type { LayoutElements } from '../types';
import { latticePlacements, readEditableLayout, type EditableLayout } from './lattice';
import { setFieldError } from './field-feedback';

const field = (id: string) => document.getElementById(id) as HTMLInputElement;
export function updateIndividualControls(model: EditableLayout): void {
  const select = document.getElementById('individualPanel') as HTMLSelectElement;
  if (!select || !model.placements) return;
  const selected = Math.min(Number(select.value) || 0, model.count - 1);
  select.replaceChildren(
    ...model.placements.map((_, i) => {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = `Panel ${i + 1}`;
      return option;
    }),
  );
  select.value = String(selected);
  const at = model.placements[selected];
  field('individualX').value = String(at.x);
  field('individualY').value = String(at.y);
  field('individualAngle').value = String(at.angle);
  (field('individualDuplicate') as HTMLButtonElement).disabled = model.count >= 144;
  (field('individualRemove') as HTMLButtonElement).disabled = model.count <= 1;
  const summary = document.getElementById('individualCount');
  if (summary) summary.textContent = `${model.count} individually placed panels`;
}
export function initializeIndividualControls(
  layout: LayoutElements,
  refresh: () => void,
  apply: (layout: LayoutElements, model: EditableLayout) => void,
): void {
  field('individualPanel')?.addEventListener('change', () => {
    if (layout.editable?.current) {
      layout.editable.error = undefined;
      for (const id of ['individualX', 'individualY']) setFieldError(id);
      updateIndividualControls(layout.editable.current);
      refresh();
    }
  });
  field('individualConvert')?.addEventListener('click', () => {
    const model = layout.editable?.current;
    if (!model || model.placements) return;
    apply(layout, { ...model, placements: latticePlacements(model, model.count) });
    refresh();
  });
  const edit = (action: 'move' | 'duplicate' | 'remove') => {
    const model = layout.editable?.current;
    if (!model?.placements || !layout.editable) return;
    if (action !== 'move' && layout.editable.error) return;
    const index = Number(field('individualPanel').value);
    const placements = model.placements.map((p) => ({ ...p }));
    if (action === 'move') {
      const x = Number(field('individualX').value),
        y = Number(field('individualY').value);
      const angle = Number(field('individualAngle').value);
      let invalid = false;
      for (const [id, value] of [
        ['individualX', x],
        ['individualY', y],
      ] as const) {
        const error =
          !field(id).value.trim() || !Number.isFinite(value) || Math.abs(value) > 100000
            ? 'Enter a coordinate between -100000 and 100000 mm.'
            : undefined;
        setFieldError(id, error);
        invalid ||= !!error;
      }
      if (invalid) {
        layout.editable.error = 'Correct the panel coordinates.';
        refresh();
        return;
      }
      placements[index] = { ...placements[index], x, y, angle: angle as 0 | 90 | 180 | 270 };
    } else if (action === 'duplicate' && placements.length < 144) {
      placements.push({ ...placements[index] });
    } else if (action === 'remove' && placements.length > 1) placements.splice(index, 1);
    const updated = readEditableLayout({ ...model, placements, count: placements.length });
    if (action === 'move') {
      // Keep the live numeric draft, including a just-typed decimal point.
      layout.editable.current = updated;
      layout.editable.error = undefined;
    } else apply(layout, updated);
    refresh();
  };
  for (const id of ['individualX', 'individualY', 'individualAngle'])
    field(id)?.addEventListener('input', () => edit('move'));
  field('individualDuplicate')?.addEventListener('click', () => edit('duplicate'));
  field('individualRemove')?.addEventListener('click', () => edit('remove'));
}
