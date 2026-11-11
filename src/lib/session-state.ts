/** sessionStorage survives a discarded tab's reload and keeps designs tab-local. */
export function initializeSessionState(
  collect: () => unknown,
  restore: (settings: unknown) => void,
  flush: () => void,
) {
  const key = 'footbag-tab-design-v1';
  let timer: ReturnType<typeof setTimeout> | undefined;
  let saving = false;
  let previous = '';
  try {
    const saved = sessionStorage.getItem(key);
    if (saved) {
      restore(JSON.parse(saved));
      previous = saved;
    }
  } catch {
    // Invalid/older data and disabled storage must never prevent app startup.
  }
  const save = () => {
    clearTimeout(timer);
    if (saving) return;
    saving = true;
    try {
      // Preserve the last valid design while a numeric field has an incomplete draft.
      const invalid = [...document.querySelectorAll<HTMLInputElement>('input[type="number"]')].some(
        (input) => input.validity.badInput || (input.value === '' && input.hasAttribute('value')),
      );
      if (invalid) return;
      flush();
      const value = JSON.stringify(collect());
      if (value !== previous) {
        sessionStorage.setItem(key, value);
        previous = value;
      }
    } catch {
      // Invalid settings or a storage quota leave the previous snapshot available.
    } finally {
      saving = false;
    }
  };
  const schedule = () => {
    if (saving) return;
    clearTimeout(timer);
    timer = setTimeout(save, 250);
  };
  for (const event of ['input', 'change', 'cut-layout-changed', 'layout-settings-applied'])
    document.addEventListener(event, schedule);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) save();
  });
  document.addEventListener('freeze', save);
  window.addEventListener('pagehide', save);
  schedule();
}
