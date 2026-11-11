import { constraintFields, readConstraints, validateConstraints } from './cutting-constraints';
import { focusFirstError } from './field-feedback';
import { syncNestingControls } from './nesting-preferences';
import { showNestingOverlay, clearNestingOverlay } from './nesting-overlay';
import { adoptPlan } from './lattice';
import { applyEditableLayout, editablePlan, patternFields } from './editable-layout';
import type { Panel, PanelConfig, PageElements, LayoutElements } from '../types';
import { manualPlacements, measureLayoutSvg, type LayoutSvgOptions } from './layout';
import { normalizeExportScale } from './export';
import { fitsStock } from './stock-nesting';
import { designKey, measurePlaced, type NestingPlan } from './nesting-types';
import { RecoverableWorker } from './recoverable-worker';
import { createNestingWorker } from './worker-factory';

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
  let worker: RecoverableWorker | undefined, candidate: NestingPlan | undefined;
  let searchBaselineKey = '';
  let clearanceKey = '',
    checkedKey = '';
  let checkedResult: { safe?: boolean; error?: string } | undefined;
  let markingTimer: ReturnType<typeof setTimeout> | undefined;
  let searchGeneration = 0,
    clearanceGeneration = 0;
  let clearanceWorker: RecoverableWorker | undefined,
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
    clearanceKey = '';
  };
  const stopSearch = () => {
    searchGeneration++;
    worker?.terminate();
    worker = undefined;
    candidate = undefined;
    searchBaselineKey = '';
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

  const currentSearchKey = () => {
    const current = getPanel(),
      opts = options();
    return JSON.stringify([
      current.panel?.outlinePath,
      opts.optimized?.placements ?? (current.panel ? manualPlacements(current.panel, opts) : []),
      readConstraints(layout),
      normalizeExportScale(layout.exportScale?.value),
    ]);
  };
  const displayClearance = (result: { safe?: boolean; error?: string }) => {
    const { panel } = getPanel();
    if (!panel || validateConstraints(layout, 'free', false).length || layout.editable?.error) {
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
    clearanceStatus.textContent = result.error
      ? 'Clearance check unavailable'
      : (result.safe ? 'Clearance OK' : 'Overlaps or insufficient gap') +
        (outside ? ' · Outside material limits' : '');
    clearanceStatus.classList.toggle('warning', !result.safe || !!outside);
  };
  // Compare the actual cut geometry after edits settle. Markings, padding and
  // export scale can change drawing bounds without changing collision geometry.
  const clearanceRequest = () => {
    const current = getPanel(),
      opts = options();
    const placements =
      opts.optimized?.placements ?? (current.panel ? manualPlacements(current.panel, opts) : []);
    const gap = Number(layout.nestingGap?.value ?? 1);
    return {
      panel: current.panel,
      placements,
      gap,
      key: JSON.stringify([current.panel?.outlinePath, placements, gap]),
    };
  };
  const scheduleClearance = () => {
    clearTimeout(clearanceTimer);
    if (worker || candidate) return;
    clearanceTimer = setTimeout(() => {
      flush();
      const errors = validateConstraints(layout, 'free', false);
      if (errors.length) validateConstraints(layout);
      if (errors.length || layout.editable?.error) {
        clearanceStatus.textContent = 'Check highlighted settings';
        return;
      }
      const request = clearanceRequest();
      if (!request.panel) return;
      if (request.key === checkedKey && checkedResult) {
        displayClearance(checkedResult);
        return;
      }
      if (request.key === clearanceKey && clearanceWorker) return;
      stopClearance();
      clearanceKey = request.key;
      const generation = clearanceGeneration;
      clearanceStatus.textContent = 'Checking clearance…';
      clearanceStatus.classList.remove('warning');
      const fail = () => {
        if (generation !== clearanceGeneration) return;
        clearanceWorker?.terminate();
        clearanceWorker = undefined;
        clearanceStatus.textContent = 'Clearance check unavailable';
      };
      try {
        clearanceWorker = new RecoverableWorker(createNestingWorker, (state) => {
          clearanceStatus.textContent =
            state === 'paused'
              ? 'Clearance check paused while this tab is inactive'
              : 'Checking clearance…';
        });
        clearanceWorker.onerror = fail;
        clearanceWorker.onmessage = (event: MessageEvent<{ safe?: boolean; error?: string }>) => {
          if (generation !== clearanceGeneration) return;
          clearanceWorker?.terminate();
          clearanceWorker = undefined;
          flush();
          if (clearanceRequest().key !== request.key) {
            scheduleClearance();
            return;
          }
          checkedKey = request.key;
          checkedResult = event.data;
          displayClearance(event.data);
        };
        clearanceWorker.postMessage({
          panel: request.panel,
          gap: request.gap,
          placements: request.placements,
        });
      } catch {
        fail();
      }
    }, 200);
  };
  const updateCandidate = (): boolean => {
    if (!candidate) return false;
    if (page.svgHost) clearNestingOverlay(page.svgHost);
    flush();
    const { panel, config, dot } = getPanel(),
      opts = options();
    if (!panel || !config || currentSearchKey() !== searchBaselineKey) {
      stopSearch();
      announce('Settings changed. Optimize again.');
      scheduleClearance();
      return false;
    }
    candidate = {
      ...candidate,
      source: designKey(config, dot, layout.editable?.current?.count ?? opts.rows * opts.cols),
    };
    if (page.svgHost) showNestingOverlay(page.svgHost, panel, candidate, dot, opts.padding ?? 10);
    const size = measurePlaced(panel, candidate.placements, dot, opts.padding ?? 10);
    const current = measureLayoutSvg(panel, opts);
    const percent = (1 - (size.width * size.height) / (current.width * current.height)) * 100;
    const comparison =
      Number.isFinite(percent) && current.width > 0 && current.height > 0
        ? ` · ${Math.abs(percent).toFixed(1)}% ${percent >= 0 ? 'less' : 'more'} sheet area`
        : '';
    const scalePercent = normalizeExportScale(layout.exportScale?.value),
      scale = scalePercent / 100;
    const fits = fitsStock(panel, candidate, dot, opts.padding ?? 10, scalePercent);
    apply.disabled = !fits;
    announce(
      `${candidate.placements.length} panels · ${(size.width * scale).toFixed(1)} × ${(size.height * scale).toFixed(1)} mm at ${scalePercent}%${comparison}` +
        (candidate.stock?.mode === 'capacity' ? ' · Best found, up to 144' : '') +
        (fits ? '' : ' · Exceeds material limits; reduce padding or adjust limits'),
    );
    return fits;
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
    const scalePercent = normalizeExportScale(layout.exportScale?.value);
    searchBaselineKey = currentSearchKey();
    phase('searching');
    cancel.focus();
    announce('Searching…');
    clearanceStatus.textContent = '';
    const fail = (error: unknown) => {
      if (generation !== searchGeneration) return;
      stopSearch();
      console.error('Nesting worker failed:', error);
      announce(
        'Could not load or run the background nesting worker after retrying. Your layout is preserved. Try optimizing again.',
      );
    };
    try {
      worker = new RecoverableWorker(createNestingWorker, (state) => {
        if (generation !== searchGeneration) return;
        const messages = {
          paused: 'Optimization paused while this tab is inactive. Resumes automatically.',
          resuming: 'Resuming optimization…',
          retrying: 'Restarting the background optimization worker…',
        };
        announce(messages[state]);
      });
      worker.onerror = fail;
      worker.onmessage = (
        event: MessageEvent<{
          plan?: NestingPlan;
          error?: string;
          phase?: 'compact';
          count?: number;
        }>,
      ) => {
        if (generation !== searchGeneration) return;
        if (event.data.phase === 'compact') {
          announce(`${event.data.count} panels found · Optimizing density…`);
          return;
        }
        worker?.terminate();
        worker = undefined;
        if (event.data.error || !event.data.plan) {
          phase('idle');
          announce(event.data.error ?? 'No arrangement found.');
          return;
        }
        candidate = event.data.plan;
        const focusResult = document.activeElement === cancel;
        phase('candidate');
        updateCandidate();
        if (focusResult && !apply.disabled) apply.focus();
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
    if (!updateCandidate()) return;
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
    clearTimeout(markingTimer);
    const pending = !!worker || !!candidate;
    stopSearch();
    announce(pending ? 'Settings changed. Optimize again.' : '');
    scheduleClearance();
  };
  for (const event of ['input', 'change'])
    document.addEventListener(event, (e) => {
      const id = (e.target as HTMLElement)?.id ?? '';
      if (
        ['zoom', 'pageZoom', 'showGrid', 'pageShowGrid', 'nestingMode', 'importFile'].includes(id)
      )
        return;
      if (['pagePadding', 'pagePaddingNumber'].includes(id)) {
        if (candidate) updateCandidate();
        else {
          flush();
          if (!worker) {
            if (checkedResult && checkedKey === clearanceRequest().key)
              displayClearance(checkedResult);
            else scheduleClearance();
          }
        }
        return;
      }
      const name = id.replace(/Number$/, '');
      if (
        [
          'stitches',
          'seam',
          'holeSpacing',
          'holeBunching',
          'cornerMargin',
          'cornerStitchSpacing',
          'cornerStitchDistance',
          'starRootOffset',
          'showHoles',
          'dotSize',
        ].includes(name)
      ) {
        clearTimeout(markingTimer);
        markingTimer = setTimeout(() => {
          flush();
          if (candidate) updateCandidate();
          else if (worker && currentSearchKey() !== searchBaselineKey) changed();
          else if (!worker) scheduleClearance();
        }, 100);
        return;
      }
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
