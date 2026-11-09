/** Inline feedback keeps existing help descriptions and native numeric validity intact. */
export function setFieldError(id: string, message?: string): void {
  const field = document.getElementById(id);
  if (!field) return;
  const errorId = `${id}Error`;
  let error = document.getElementById(errorId);
  const descriptions = new Set(
    (field.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean),
  );
  if (message) {
    if (!error) {
      error = document.createElement('small');
      error.id = errorId;
      error.className = 'field-error';
      field.insertAdjacentElement('afterend', error);
    }
    error.textContent = message;
    field.setAttribute('aria-invalid', 'true');
    descriptions.add(errorId);
    const details = field.closest('details');
    if (details) details.open = true;
  } else {
    error?.remove();
    field.removeAttribute('aria-invalid');
    descriptions.delete(errorId);
  }
  if (descriptions.size) field.setAttribute('aria-describedby', [...descriptions].join(' '));
  else field.removeAttribute('aria-describedby');
}

/** Bounds/steps come from the same HTML controls checked against the settings schema. */
export function numberFieldError(
  field: HTMLInputElement,
  label: string,
  required = true,
): string | undefined {
  if (!field.value && !field.validity.badInput) return required ? `Enter ${label}.` : undefined;
  if (!Number.isFinite(field.valueAsNumber) || field.validity.badInput)
    return `Enter a number for ${label}.`;
  if (field.validity.rangeUnderflow || field.validity.rangeOverflow)
    return `Enter ${label} from ${field.min} to ${field.max}.`;
  if (field.validity.stepMismatch)
    return field.step === '1'
      ? `Enter a whole number for ${label}.`
      : `Use increments of ${field.step} for ${label}.`;
  return undefined;
}

export function focusFirstError(ids: string[]): void {
  for (const id of ids) {
    const field = document.getElementById(id);
    if (field?.getAttribute('aria-invalid') === 'true') {
      field.focus();
      return;
    }
  }
}
