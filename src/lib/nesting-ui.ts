import { constraintFields, readConstraints, validateConstraints } from './cutting-constraints';
import { focusFirstError } from './field-feedback';
import { syncNestingControls } from './nesting-preferences';
import { showNestingOverlay, clearNestingOverlay } from './nesting-overlay';
import { adoptPlan } from './lattice';
import { applyEditableLayout, editablePlan, patternFields } from './editable-layout';
import type { Panel, PanelConfig, PageElements, LayoutElements } from '../types';
import { manualPlacements, measureLayoutSvg, type LayoutSvgOptions } from './layout';
import { normalizeExportScale } from './export';
import { designKey, measurePlaced, type NestingPlan } from './nesting-types';

export function initializeNesting(
  layout: LayoutElements,
  page: PageElements,
  getPanel: () => { panel: Panel | null; config: PanelConfig | null; dot: number },
  flush: () => void,
  refresh: () => void,
): void {
  const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const optimize = element<HTMLButtonElement>('optimizeLayout');
  const apply = element<HTMLButtonElement>('applyNesting');
  const cancel = element<HTMLButtonElement>('cancelNesting');
  const dialog = element<HTMLDialogElement>('nestingDialog');
  const mode = element<HTMLSelectElement>('nestingMode');
  const status = element('nestingStatus');
  const clearanceStatus = element('clearanceStatus');
  let worker: Worker | undefined, candidate: NestingPlan | undefined;
  let searchGeneration = 0,
    clearanceGeneration = 0;
  let clearanceWorker: Worker | undefined,
    clearanceTimer: ReturnType<typeof setTimeout> | undefined;

  const phase = (value: 'idle' | 'searching' | 'candidate') => {
    element('optimizeEntry').classList.toggle('hidden', value !== 'idle');
    element('nestingActions').classList.toggle('hidden', value === 'idle');
    apply.hidden = value !== 'candidate';
    apply.disabled = value !== 'candidate';
    cancel.disabled = value === 'idle';
    cancel.textContent = value === 'candidate' ? 'Discard' : 'Cancel';
  };
  const announce = (message: string) => {
    status.textContent = message;
    element('nestingComparison').classList.toggle('hidden', !message);
  };
  const stopClearance = () => {
    clearTimeout(clearanceTimer);
    clearanceWorker?.terminate();
    clearanceWorker = undefined;
    clearanceGeneration++;
  };
  const stopSearch = () => {
    searchGeneration++;
    worker?.terminate();
    worker = undefined;
    candidate = undefined;
    if (page.svgHost) clearNestingOverlay(page.svgHost);
    phase('idle');
  };
  const options = (): LayoutSvgOptions => {
    const model = layout.editable?.current,
      current = getPanel();
    return {
      rows: model ? Math.ceil(model.count / model.columns) : Number(layout.pageRows?.value ?? 3),
      cols: model?.columns ?? Number(layout.pageCols?.value ?? 3),
      hSpace: Number(layout.pageHSpaceNumber?.value ?? 0),
      vSpace: Number(layout.pageVSpace?.value ?? 1),
      invertOdd: !!layout.pageInvert?.checked,
      nestingVerticalOffset: Number(layout.nestingOffset?.value ?? 0),
      dotDiameter: current.dot,
      padding: Number(layout.pagePadding?.value ?? 10),
      showGrid: !!page.showGrid?.checked,
      optimized:
        model && current.config
          ? editablePlan(model, current.config, current.dot)
          : layout.nesting?.active,
    };
  };

  // Advisory checks run off-thread after edits settle. Pattern SVG exports keep
  // the synchronous safety guard in the renderer and download flush.
  const scheduleClearance = () => {
    stopClearance();
    if (worker || candidate) return;
    clearanceStatus.textContent = 'Checking clearance…';
    clearanceStatus.classList.remove('warning');
    const generation = clearanceGeneration;
    clearanceTimer = setTimeout(() => {
      flush();
      const { panel, config } = getPanel();
      if (!panel || !config) return;
      const constraintErrors = validateConstraints(layout, 'free', false);
      if (constraintErrors.length) validateConstraints(layout);
      if (constraintErrors.length || layout.editable?.error) {
        clearanceStatus.textContent = 'Check highlighted settings';
        return;
      }
      const opts = options(),
        constraints = readConstraints(layout);
      const size = measureLayoutSvg(panel, opts),
        scale = normalizeExportScale(layout.exportScale?.value) / 100;
      const outside =
        constraints.stock &&
        (size.width * scale > constraints.stock.width + 1e-8 ||
          (constraints.stock.height !== undefined &&
            size.height * scale > constraints.stock.height + 1e-8));
      const fail = () => {
        if (generation !== clearanceGeneration) return;
        clearanceWorker?.terminate();
        clearanceWorker = undefined;
        clearanceStatus.textContent = 'Clearance check unavailable';
      };
      try {
        clearanceWorker = new Worker(new URL('./nesting-worker.ts', import.meta.url), {
          type: 'module',
        });
        clearanceWorker.onerror = (event) => {
          event.preventDefault();
          fail();
        };
        clearanceWorker.onmessage = (event: MessageEvent<{ safe?: boolean; error?: string }>) => {
          if (generation !== clearanceGeneration) return;
          clearanceWorker?.terminate();
          clearanceWorker = undefined;
          clearanceStatus.textContent = event.data.error
            ? 'Clearance check unavailable'
            : (event.data.safe ? 'Clearance OK' : 'Overlaps or insufficient gap') +
              (outside ? ' · Outside material limits' : '');
          clearanceStatus.classList.toggle('warning', !event.data.safe || !!outside);
        };
        clearanceWorker.postMessage({
          panel,
          gap: constraints.gap,
          placements: opts.optimized?.placements ?? manualPlacements(panel, opts),
        });
      } catch {
        fail();
      }
    }, 200);
  };

  const searchSummary = () => {
    syncNestingControls(layout);
    element('nestingSearchSummary').textContent =
      `Gap ${layout.nestingGap?.value || '—'} mm · ${layout.nestingRotation?.selectedOptions[0]?.textContent ?? ''} · ` +
      (layout.nestingStockWidth?.value
        ? `Stock ${layout.nestingStockWidth.value}${layout.nestingStockHeight?.value ? ' × ' + layout.nestingStockHeight.value : ' wide'} mm`
        : 'No material limits');
  };
  optimize.addEventListener('click', () => {
    searchSummary();
    dialog.showModal();
  });
  const closeDialog = () => {
    dialog.close();
    optimize.focus();
  };
  element('closeNestingDialog').addEventListener('click', closeDialog);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeDialog();
  });
  element('editNestingSettings').addEventListener('click', () => {
    dialog.close();
    layout.nestingGap?.focus();
  });
  mode.addEventListener('change', searchSummary);

  element('startNesting').addEventListener('click', () => {
    dialog.close();
    stopSearch();
    stopClearance();
    flush();
    const { panel, config, dot } = getPanel();
    if (!panel || !config) return;
    const errors = validateConstraints(layout, mode.value);
    if (errors.length || layout.editable?.error) {
      announce(errors.join(' ') || layout.editable?.error || 'Check highlighted settings');
      focusFirstError([...patternFields, ...constraintFields]);
      return;
    }
    const constraints = readConstraints(layout),
      opts = options();
    const stock = constraints.stock
      ? {
          ...constraints.stock,
          mode: mode.value === 'capacity' ? ('capacity' as const) : ('fit' as const),
        }
      : undefined;
    const count = layout.editable?.current?.count ?? opts.rows * opts.cols;
    const source = designKey(config, dot, count),
      generation = searchGeneration;
    const current = measureLayoutSvg(panel, opts),
      scalePercent = normalizeExportScale(layout.exportScale?.value);
    phase('searching');
    cancel.focus();
    announce('Searching…');
    clearanceStatus.textContent = '';
    const fail = (error: unknown) => {
      if (generation !== searchGeneration) return;
      stopSearch();
      console.error('Nesting worker failed:', error);
      announce(
        'Could not load or run the background nesting worker. Reload and retry; keep the local preview server running.',
      );
    };
    try {
      worker = new Worker(new URL('./nesting-worker.ts', import.meta.url), { type: 'module' });
      worker.onerror = (event) => {
        event.preventDefault();
        fail(event.message);
      };
      worker.onmessage = (event: MessageEvent<{ plan?: NestingPlan; error?: string }>) => {
        if (generation !== searchGeneration) return;
        worker?.terminate();
        worker = undefined;
        if (event.data.error || !event.data.plan) {
          phase('idle');
          announce(event.data.error ?? 'No arrangement found.');
          return;
        }
        candidate = event.data.plan;
        if (page.svgHost)
          showNestingOverlay(page.svgHost, panel, candidate, dot, opts.padding ?? 10);
        const focusResult = document.activeElement === cancel;
        phase('candidate');
        if (focusResult) apply.focus();
        const size = measurePlaced(panel, candidate.placements, dot, opts.padding ?? 10);
        const percent = (1 - (size.width * size.height) / (current.width * current.height)) * 100;
        const comparison =
          Number.isFinite(percent) && current.width > 0 && current.height > 0
            ? ` · ${Math.abs(percent).toFixed(1)}% ${percent >= 0 ? 'less' : 'more'} sheet area`
            : '';
        const scale = scalePercent / 100;
        announce(
          `${candidate.placements.length} panels · ${(size.width * scale).toFixed(1)} × ${(size.height * scale).toFixed(1)} mm at ${scalePercent}%${comparison}` +
            (candidate.stock?.mode === 'capacity' ? ' · Best found, up to 144' : ''),
        );
      };
      worker.postMessage({
        panel,
        count,
        ...constraints,
        ...(stock ? { stock } : {}),
        scalePercent,
        source,
        padding: opts.padding ?? 10,
        dot,
        cols: opts.cols,
      });
    } catch (error) {
      fail(error);
    }
  });

  apply.addEventListener('click', () => {
    flush();
    const current = getPanel(),
      opts = options();
    if (
      !candidate ||
      !current.config ||
      candidate.source !==
        designKey(
          current.config,
          current.dot,
          layout.editable?.current?.count ?? opts.rows * opts.cols,
        )
    ) {
      stopSearch();
      announce('Settings changed. Optimize again.');
      return;
    }
    try {
      applyEditableLayout(layout, adoptPlan(candidate));
    } catch (error) {
      stopSearch();
      announce(error instanceof Error ? error.message : 'Unable to apply layout.');
      return;
    }
    if (layout.nesting) {
      layout.nesting.active = undefined;
      layout.nesting.constraintsEdited = false;
    }
    stopSearch();
    refresh();
    announce('Layout applied');
    scheduleClearance();
    optimize.focus();
  });
  cancel.addEventListener('click', () => {
    const discarded = !!candidate;
    stopSearch();
    announce(discarded ? 'Candidate discarded' : 'Search cancelled');
    scheduleClearance();
    optimize.focus();
  });
  const changed = () => {
    const pending = !!worker || !!candidate;
    stopSearch();
    announce(pending ? 'Settings changed. Optimize again.' : '');
    scheduleClearance();
  };
  for (const event of ['input', 'change'])
    document.addEventListener(event, (e) => {
      if (
        ['zoom', 'pageZoom', 'showGrid', 'pageShowGrid', 'nestingMode', 'importFile'].includes(
          (e.target as HTMLElement)?.id,
        )
      )
        return;
      changed();
    });
  for (const id of ['resetPanelSettings', 'resetLayoutSettings'])
    element(id).addEventListener('click', changed);
  document.addEventListener('layout-settings-applied', () => {
    if (dialog.open) dialog.close();
    changed();
  });
  syncNestingControls(layout);
  phase('idle');
  scheduleClearance();
}
