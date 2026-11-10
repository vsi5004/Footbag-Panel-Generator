import type { GcodeJobResult } from './gcode-runner';
import { normalizeExportScale } from './export';
import { applyGcodeSettings, collectGcodeSettings } from './gcode-settings';
import { createJobSnapshot, type CutLayout, type JobSnapshot } from './gcode-job';
import { GcodeService } from './gcode-service';
import { createGcodeViewport } from './gcode-viewport';
import type { SettingsData } from './state';

type GcodeState =
  | { kind: 'empty' | 'stale' | 'failed' }
  | { kind: 'generating'; snapshot: JobSnapshot }
  | { kind: 'ready'; snapshot: JobSnapshot; result: GcodeJobResult };

export function initializeGcode(
  flush: () => void,
  revalidate: () => void,
  getLayout: () => CutLayout | undefined,
  getSettings: () => SettingsData,
) {
  const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const generate = byId<HTMLButtonElement>('generateGcode'),
    download = byId<HTMLButtonElement>('exportGcode');
  if (!generate) return;
  const status = byId('gcodeStatus'),
    stats = byId('gcodeStats');
  const code = byId<HTMLTextAreaElement>('gcodeCode'),
    host = byId<HTMLDivElement>('gcodeViewport');
  const view = byId<HTMLSelectElement>('gcodeView'),
    travel = byId<HTMLInputElement>('gcodeShowTravel');
  const freshness = byId('gcodeFreshness'),
    freshnessText = byId('gcodeFreshnessText'),
    regenerate = byId<HTMLButtonElement>('gcodeRegenerate');
  const viewport = createGcodeViewport(host, travel),
    service = new GcodeService();
  let state: GcodeState = { kind: 'empty' };
  applyGcodeSettings();
  function snapshot(validate = false) {
    if (validate) {
      flush();
      revalidate();
    }
    const settings = collectGcodeSettings();
    return createJobSnapshot(
      getLayout(),
      normalizeExportScale(document.querySelector<HTMLInputElement>('[data-export-scale]')?.value),
      settings,
      settings.includeSettings ? getSettings() : undefined,
    );
  }
  function clear() {
    download.disabled = true;
    code.value = '';
    viewport.clear();
    stats.textContent = '';
  }
  function invalidate() {
    if (state.kind !== 'ready' && state.kind !== 'generating' && state.kind !== 'failed') return;
    service.cancel();
    state = { kind: 'stale' };
    clear();
    freshness.hidden = false;
    freshnessText.textContent = 'Stale - needs regeneration';
    regenerate.textContent = 'Regenerate';
    status.textContent =
      'Layout or settings changed. Generate GCode to update the preview and export.';
  }
  // Model notifications replace observing SVG mutations. Temporary optimizer
  // candidates and preview-only interactions never change this snapshot.
  document.addEventListener('cut-layout-changed', () => {
    if (state.kind !== 'ready' && state.kind !== 'generating') return;
    try {
      if (snapshot().key !== state.snapshot.key) invalidate();
    } catch {
      invalidate();
    }
  });
  for (const event of ['input', 'change'])
    document.addEventListener(event, (e) => {
      const target = e.target as HTMLElement;
      if (
        target.closest('#gcodePreview') ||
        target.closest('.preview') ||
        target.closest('#nestingDialog')
      )
        return;
      invalidate();
    });
  document.addEventListener('layout-settings-applied', invalidate);
  const showView = () => {
    code.hidden = view.value !== 'code';
    host.hidden = view.value === 'code';
    byId('gcodeToolpathControls').hidden = view.value === 'code';
  };
  view.addEventListener('change', showView);
  regenerate.addEventListener('click', () => generate.click());
  generate.addEventListener('click', async () => {
    service.cancel();
    state = { kind: 'empty' };
    clear();
    let requested: JobSnapshot | undefined;
    try {
      requested = snapshot(true);
      state = { kind: 'generating', snapshot: requested };
      freshness.hidden = false;
      freshnessText.textContent = 'Generating GCode…';
      regenerate.textContent = 'Restart';
      status.textContent = 'Generating cutting paths…';
      const result = await service.generate(requested);
      if (state.kind !== 'generating' || state.snapshot !== requested) return;
      // Flush same-task/debounced edits before publishing a worker response.
      const current = snapshot(true);
      if (current.key !== requested.key) {
        invalidate();
        return;
      }
      state = { kind: 'ready', snapshot: requested, result };
      code.value = result.code;
      viewport.render(result.preview);
      stats.textContent = `${result.sheet.width.toFixed(2)} × ${result.sheet.height.toFixed(2)} mm · ${result.cutCount} cuts · Cut: ${result.cutDistance.toFixed(1)} mm · Travel: ${result.travelDistance.toFixed(1)} mm`;
      status.textContent = result.warnings.length
        ? `Generated. Custom commands not simulated: ${result.warnings.join(', ')}. Verify these on your machine; displayed distances exclude unsupported motion.`
        : 'Ready to export. Toolpath includes start/end linear moves; initial position assumed X0 Y0.';
      download.disabled = false;
      freshness.hidden = true;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      if (requested && (state.kind !== 'generating' || state.snapshot !== requested)) return;
      state = { kind: 'failed' };
      clear();
      freshness.hidden = false;
      let reason = error instanceof Error ? error.message : 'Unable to generate GCode. Try again.';
      const invalid = /^Invalid GCode (\w+)/.exec(reason);
      if (invalid) {
        const id = `gcode-${invalid[1]}`;
        const field = document.getElementById(id) as HTMLInputElement | null;
        const label =
          document.querySelector(`label[for="${id}"]`)?.textContent?.trim() ?? invalid[1];
        reason =
          field?.type === 'number'
            ? `${label}: enter a number between ${field.min} and ${field.max}.`
            : `${label}: check this setting${reason.includes(':') ? ': ' + reason.split(':').slice(1).join(':').trim() : '.'}`;
      }
      freshnessText.textContent = `Generation failed: ${reason}`;
      regenerate.textContent = 'Try again';
      status.textContent = reason;
    }
  });
  download.addEventListener('click', () => {
    if (state.kind !== 'ready') return;
    const ready = state;
    try {
      const current = snapshot(true);
      if (current.key !== ready.snapshot.key) {
        invalidate();
        return;
      }
      const url = URL.createObjectURL(new Blob([ready.result.code], { type: 'text/plain' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `footbag-layout-${ready.result.panelCount}panels.gcode`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      invalidate();
      status.textContent = error instanceof Error ? error.message : 'Unable to export GCode';
    }
  });
  byId('resetGcodeSettings').addEventListener('click', () => {
    applyGcodeSettings();
    invalidate();
  });
  showView();
}
