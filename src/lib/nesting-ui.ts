import { focusFirstError, numberFieldError, setFieldError } from './field-feedback';
import { syncNestingControls } from './nesting-preferences';
import { showNestingOverlay, clearNestingOverlay } from './nesting-overlay';
import { adoptPlan } from './lattice';
import { applyEditableLayout, editablePlan, patternFields } from './editable-layout';
import type { Panel, PanelConfig, PageElements, LayoutElements } from '../types';
import { manualPlacements, measureLayoutSvg, type LayoutSvgOptions } from './layout';
import { normalizeExportScale } from './export';
import { readStock, readRotations } from './stock-nesting';
import type { StockConstraint } from './nesting-types';
import { designKey, measurePlaced, type NestingPlan } from './nesting-types';

export function initializeNesting(
  layout: LayoutElements,
  page: PageElements,
  getPanel: () => { panel: Panel | null; config: PanelConfig | null; dot: number },
  flush: () => void,
  refresh: () => void,
): void {
  const optimize = document.getElementById('optimizeLayout') as HTMLButtonElement;
  const check = document.getElementById('checkClearance') as HTMLButtonElement;
  const apply = document.getElementById('applyNesting') as HTMLButtonElement;
  const manual = document.getElementById('manualLayout') as HTMLButtonElement;
  const cancel = document.getElementById('cancelNesting') as HTMLButtonElement;
  const gapInput = document.getElementById('nestingGap') as HTMLInputElement;
  const rotation = document.getElementById('nestingRotation') as HTMLSelectElement;
  const mode = document.getElementById('nestingMode') as HTMLSelectElement;
  const stockWidth = document.getElementById('nestingStockWidth') as HTMLInputElement;
  const stockHeight = document.getElementById('nestingStockHeight') as HTMLInputElement;
  const status = document.getElementById('nestingStatus')!;
  const searchFields = ['nestingGap', 'nestingStockWidth', 'nestingStockHeight'];
  let validationActive = false,
    lastCheckOnly = false;
  const validateOptions = (checkOnly: boolean): string[] => {
    const errors: string[] = [];
    const stockRequired = !checkOnly && mode.value !== 'free';
    for (const [field, label, required, enabled] of [
      [gapInput, 'minimum cutting gap', true, true],
      [stockWidth, 'stock width', true, stockRequired],
      [stockHeight, 'stock height', mode.value === 'capacity', stockRequired],
    ] as const) {
      const message = enabled ? numberFieldError(field, label, required) : undefined;
      setFieldError(field.id, message);
      if (message) errors.push(message);
    }
    return errors;
  };
  syncNestingControls(layout);
  for (const field of [mode, gapInput, stockWidth, stockHeight])
    for (const event of ['input', 'change'])
      field.addEventListener(event, () => {
        syncNestingControls(layout);
        if (validationActive) validateOptions(lastCheckOnly);
      });
  let worker: Worker | undefined, candidate: NestingPlan | undefined;
  const stop = () => {
    if (page.svgHost) clearNestingOverlay(page.svgHost);
    worker?.terminate();
    worker = undefined;
    candidate = undefined;
    optimize.disabled = false;
    check.disabled = false;
    cancel.disabled = true;
    cancel.textContent = 'Cancel search';
    apply.disabled = true;
  };
  const options = (): LayoutSvgOptions => ({
    rows: layout.editable?.current
      ? Math.ceil(layout.editable.current.count / layout.editable.current.columns)
      : Number(layout.pageRows?.value ?? 3),
    cols: layout.editable?.current?.columns ?? Number(layout.pageCols?.value ?? 3),
    hSpace: Number(layout.pageHSpaceNumber?.value ?? 0),
    vSpace: Number(layout.pageVSpace?.value ?? 1),
    invertOdd: !!layout.pageInvert?.checked,
    nestingVerticalOffset: Number(layout.nestingOffset?.value ?? 0),
    dotDiameter: getPanel().dot,
    padding: Number(layout.pagePadding?.value ?? 10),
    showGrid: !!page.showGrid?.checked,
    optimized:
      layout.editable?.current && getPanel().config
        ? editablePlan(layout.editable.current, getPanel().config!, getPanel().dot)
        : layout.nesting?.active,
  });
  const start = (checkOnly: boolean) => {
    stop();
    flush();
    const { panel, config, dot } = getPanel();
    if (!panel || !config) return;
    validationActive = true;
    lastCheckOnly = checkOnly;
    const errors = validateOptions(checkOnly);
    if (layout.editable?.error) {
      status.textContent = layout.editable.error;
      focusFirstError(patternFields);
      return;
    }
    if (errors.length) {
      status.textContent =
        errors.join(' ') +
        (mode.value === 'capacity' && !checkOnly
          ? ' Capacity mode requires both width and height.'
          : '');
      focusFirstError(searchFields);
      return;
    }
    const gap = Number(gapInput.value);
    const stock: StockConstraint | undefined =
      !checkOnly && mode.value !== 'free'
        ? readStock({
            mode: mode.value,
            width: Number(stockWidth.value),
            ...(stockHeight.value.trim() !== '' ? { height: Number(stockHeight.value) } : {}),
          })
        : undefined;
    const scalePercent = normalizeExportScale(layout.exportScale?.value);
    const opts = options(),
      count = layout.editable?.current?.count ?? opts.rows * opts.cols,
      source = designKey(config, dot, count);
    const current = measureLayoutSvg(panel, opts);
    optimize.disabled = true;
    check.disabled = true;
    cancel.disabled = false;
    status.textContent = checkOnly
      ? 'Checking clearance...'
      : 'Searching aligned, alternating and staggered layouts...';
    const workerFailed = (error: unknown) => {
      stop();
      console.error('Nesting worker failed:', error);
      status.textContent =
        'The app could not load or run the background nesting worker. Your current layout is unchanged. Reload the page and retry; local previews require the server to stay running.';
    };
    try {
      worker = new Worker(new URL('./nesting-worker.ts', import.meta.url), { type: 'module' });
    } catch (error) {
      workerFailed(error);
      return;
    }
    worker.onerror = (event) => {
      event.preventDefault();
      workerFailed(event.message || 'Worker script could not be loaded.');
    };
    worker.onmessage = (
      event: MessageEvent<{ plan?: NestingPlan; safe?: boolean; error?: string }>,
    ) => {
      worker?.terminate();
      worker = undefined;
      optimize.disabled = false;
      check.disabled = false;
      cancel.disabled = true;
      const latest = getPanel(),
        now = options();
      if (
        !latest.config ||
        designKey(
          latest.config,
          latest.dot,
          layout.editable?.current?.count ?? now.rows * now.cols,
        ) !== source
      ) {
        stop();
        status.textContent = 'Design changed. Run the search again.';
        return;
      }
      if (event.data.error) {
        status.textContent = event.data.error;
        return;
      }
      if (checkOnly) {
        status.textContent = event.data.safe
          ? 'All cut outlines meet the requested gap, including a conservative curve allowance.'
          : 'Some cut outlines overlap, touch, or are too close for the requested gap (including the curve allowance). This check does not change the placement settings.';
        return;
      }
      candidate = event.data.plan;
      if (!candidate) return;
      if (page.svgHost) showNestingOverlay(page.svgHost, panel, candidate, dot, opts.padding ?? 10);
      cancel.disabled = false;
      cancel.textContent = 'Reject candidate';
      const previewHint =
        ' Translucent green shows the candidate over the current sheet. Apply or reject to finish the comparison.';
      const size = measurePlaced(panel, candidate.placements, dot, opts.padding ?? 10);
      if (candidate.stock) {
        const s = candidate.stock,
          scale = scalePercent / 100;
        status.textContent =
          (s.mode === 'capacity' ? 'Best capacity found: ' : 'Candidate: ') +
          candidate.placements.length +
          ' panels, ' +
          (size.width * scale).toFixed(1) +
          ' × ' +
          (size.height * scale).toFixed(1) +
          ' mm at ' +
          scalePercent +
          '% export. Fits stock ' +
          s.width +
          ' mm wide' +
          (s.height !== undefined ? ' × ' + s.height + ' mm high' : '') +
          (s.mode === 'capacity' ? '. Search limit: 144 panels; not a proven maximum.' : '.') +
          ' Apply to use this arrangement.' +
          previewHint;
        apply.disabled = false;
        return;
      }
      const percent = (1 - (size.width * size.height) / (current.width * current.height)) * 100;
      const comparison =
        Number.isFinite(percent) && current.width > 0 && current.height > 0
          ? ' (' +
            Math.abs(percent).toFixed(1) +
            '% ' +
            (percent >= 0 ? 'less' : 'more') +
            ' sheet area than the current layout)'
          : '';
      status.textContent =
        'Candidate: ' +
        size.width.toFixed(1) +
        ' × ' +
        size.height.toFixed(1) +
        ' mm' +
        comparison +
        '. ' +
        candidate.placements.length +
        ' panels, minimum gap ' +
        gap +
        ' mm at 100% export. Apply to use this arrangement.' +
        previewHint;
      apply.disabled = false;
    };
    worker.postMessage({
      panel,
      count,
      gap,
      rotations: readRotations(rotation.value),
      scalePercent,
      ...(stock ? { stock } : {}),
      source,
      padding: opts.padding ?? 10,
      dot,
      cols: opts.cols,
      ...(checkOnly
        ? { placements: opts.optimized?.placements ?? manualPlacements(panel, opts) }
        : {}),
    });
  };
  optimize.addEventListener('click', () => start(false));
  check.addEventListener('click', () => start(true));
  apply.addEventListener('click', () => {
    flush();
    const { config, dot } = getPanel(),
      opts = options();
    if (
      !candidate ||
      !config ||
      candidate.source !==
        designKey(config, dot, layout.editable?.current?.count ?? opts.rows * opts.cols)
    ) {
      stop();
      return;
    }
    try {
      applyEditableLayout(layout, adoptPlan(candidate));
    } catch (error) {
      stop();
      status.textContent =
        error instanceof Error ? error.message : 'Unable to adopt this arrangement.';
      return;
    }
    if (layout.nesting) layout.nesting.active = undefined;
    const gap = candidate.gap,
      stock = candidate.stock,
      count = candidate.placements.length;
    stop();
    refresh();
    status.textContent =
      (stock
        ? (stock.mode === 'capacity' ? 'Capacity layout applied: ' : 'Stock layout applied: ') +
          count +
          ' panels, stock ' +
          stock.width +
          ' mm wide' +
          (stock.height !== undefined ? ' × ' + stock.height + ' mm high' : '') +
          '. '
        : 'Optimized layout applied. ') +
      'Minimum gap ' +
      gap +
      ' mm at 100% export. Pattern layout settings now contain this arrangement and remain editable.';
  });
  manual.addEventListener('click', () => {
    stop();
    if (layout.nesting) layout.nesting.active = undefined;
    applyEditableLayout(layout);
    refresh();
    status.textContent = 'Grid layout selected.';
  });
  cancel.addEventListener('click', () => {
    const rejected = !!candidate;
    stop();
    status.textContent = rejected
      ? 'Candidate rejected. Current layout unchanged.'
      : 'Search cancelled. Current layout unchanged.';
  });
  for (const id of ['resetPanelSettings', 'resetLayoutSettings'])
    document.getElementById(id)?.addEventListener('click', () => {
      if (worker || candidate) {
        stop();
        status.textContent = 'Settings reset. Run the search again.';
      }
    });
  for (const event of ['input', 'change'])
    document.addEventListener(event, (e) => {
      if (['zoom', 'pageZoom'].includes((e.target as HTMLElement)?.id)) return;
      if (worker || candidate) {
        stop();
        status.textContent = 'Settings changed. Run the search or clearance check again.';
      } else if (
        (layout.nesting?.active || layout.editable?.current) &&
        [rotation, mode, stockWidth, stockHeight, gapInput].includes(e.target as HTMLInputElement)
      ) {
        status.textContent =
          'Search options changed. The current Pattern layout keeps its settings. Apply a new candidate to replace them.';
      }
    });
}
