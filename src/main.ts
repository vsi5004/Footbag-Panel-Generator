import { designKey } from './lib/nesting-types';
import { initializeGcode } from './lib/gcode-ui';
import { initializeEditableLayout } from './lib/editable-layout';
import type { Panel, PanelElements, PageElements, PanelConfig } from './types';
import { normalizeExportScale, syncExportScaleControls } from './lib/export';
import {
  createMainElements,
  createPageElements,
  getLayoutElements,
  validateCriticalElements,
} from './lib/dom';
import {
  renderLayout,
  renderSVGToDOM,
  updatePageOverflow,
  createMainRenderFunction,
} from './lib/renderer';
import { createFrameScheduler } from './lib/frame-scheduler';
import {
  resetPanelSettings,
  resetLayoutSettings,
  downloadSvg,
  createPanelFilename,
  createLayoutFilename,
  exportSettings,
  setupImportSettings,
} from './lib/events';

import { CONSTANTS } from './lib/constants';
import { ui as UI } from './lib/ui';
import { panelControlPairs, layoutControlPairs } from './lib/controls';
import { initializeNesting } from './lib/nesting-ui';
import { initializeTooltips } from './lib/tooltips';

function initializeApp(): void {
  const { PERFORMANCE } = CONSTANTS;

  const el: PanelElements = createMainElements();
  const pageEl: PageElements = createPageElements();
  const layoutElements = getLayoutElements();

  if (!validateCriticalElements(el)) {
    console.error('Critical DOM elements missing');
    return;
  }

  // Keep the most recent single-panel result for the layout preview
  let lastPanel: Panel | null = null;
  let lastDotSize: number = 1;
  let lastPanelConfig: PanelConfig | null = null;
  const layoutState = {
    lastLayoutWpx: 0,
    lastLayoutHpx: 0,
  };

  const layoutFrame = createFrameScheduler(() => {
    renderLayout(lastPanel, lastDotSize, pageEl, layoutElements, layoutState, lastPanelConfig);
    requestAnimationFrame(() => updatePageOverflow(pageEl, layoutState));
  });
  function createLayoutRenderFunction() {
    return (panel: Panel | null, dotSize: number, config?: PanelConfig) => {
      const active = layoutElements.nesting?.active;
      const count =
        Number(layoutElements.pageRows?.value ?? 3) * Number(layoutElements.pageCols?.value ?? 3);
      // Markings can change without changing the cut outline. Keep legacy
      // explicit positions, while the renderer still checks their stock bounds.
      if (
        active &&
        panel &&
        config &&
        lastPanelConfig &&
        lastPanel?.outlinePath === panel.outlinePath &&
        active.source === designKey(lastPanelConfig, lastDotSize, count)
      ) {
        layoutElements.nesting!.active = { ...active, source: designKey(config, dotSize, count) };
      }
      lastPanel = panel;
      lastDotSize = dotSize;
      if (config) lastPanelConfig = config;
      layoutFrame.schedule();
    };
  }

  const renderLayoutFn = createLayoutRenderFunction();
  const render = createMainRenderFunction(el, renderLayoutFn);

  function debounce(fn: () => void, ms: number) {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      if (timeoutHandle === undefined) return;
      clearTimeout(timeoutHandle);
      timeoutHandle = undefined;
      fn();
    };
    const schedule = () => {
      clearTimeout(timeoutHandle);
      timeoutHandle = setTimeout(flush, ms);
    };
    return Object.assign(schedule, { flush });
  }

  const debouncedRender = debounce(render, PERFORMANCE.DEBOUNCE_MS);
  const flushRenders = () => {
    debouncedRender.flush();
    if (layoutElements.nesting?.active?.stock || layoutElements.editable?.current?.stock)
      layoutFrame.schedule();
    layoutFrame.flush();
  };

  function bindPanelControls(): void {
    el.resetPanelSettings?.addEventListener('click', () => {
      resetPanelSettings(el, UI, debouncedRender);
    });

    for (const [range, display] of panelControlPairs(el)) {
      UI.syncPair(range, display, debouncedRender);
    }

    const onShapeOrHexTypeChange = (): void => {
      UI.updateVisibility(el);
      debouncedRender();
    };

    el.shape?.addEventListener('change', onShapeOrHexTypeChange);
    el.curved?.addEventListener('change', () => {
      UI.updateVisibility(el);
      debouncedRender();
    });
    el.showHoles?.addEventListener('change', () => {
      UI.updateVisibility(el);
      debouncedRender();
    });
    el.cornerStitchSpacing?.addEventListener('change', () => {
      UI.updateVisibility(el);
      debouncedRender();
    });
    el.stitches?.addEventListener('input', () => {
      UI.updateVisibility(el);
      debouncedRender();
    });

    el.hexType?.addEventListener('change', onShapeOrHexTypeChange);
  }

  function bindPanelPreview(): void {
    const zoomControls = UI.zoom;
    el.zoom?.addEventListener('input', () => {
      zoomControls.updateDisplay(el);
      zoomControls.apply(el);
    });
    el.zoomIn?.addEventListener('click', () => zoomControls.adjustBy(el, 10));
    el.zoomOut?.addEventListener('click', () => zoomControls.adjustBy(el, -10));
    el.zoomReset?.addEventListener('click', () => zoomControls.setPct(el, 200));

    el.showGrid?.addEventListener('change', () => {
      // Settle any real design edit; a grid-only change touches just this preview.
      flushRenders();
      if (lastPanel) renderSVGToDOM(lastPanel, lastDotSize, el, lastPanelConfig ?? undefined);
    });
  }

  function bindExportControls(): void {
    const readExportScale = (): number => {
      const scale = normalizeExportScale(el.exportScale?.value);
      syncExportScaleControls(scale);
      return scale;
    };
    for (const field of document.querySelectorAll<HTMLInputElement>('[data-export-scale]')) {
      for (const event of ['input', 'change'])
        field.addEventListener(event, () => {
          syncExportScaleControls(
            event === 'change' ? normalizeExportScale(field.value) : field.value,
          );
          if (layoutElements.nesting?.active?.stock || layoutElements.editable?.current?.stock)
            renderLayoutFn(lastPanel, lastDotSize, lastPanelConfig ?? undefined);
        });
    }

    el.downloadSvg?.addEventListener('click', () => {
      flushRenders();
      const svg = el.svgHost?.querySelector('svg');
      if (!svg) return;
      downloadSvg(svg, createPanelFilename(el), readExportScale());
    });

    if (el.exportSettings) {
      el.exportSettings.addEventListener('click', () => {
        flushRenders();
        try {
          exportSettings(el, { ...layoutElements, pageEl });
        } catch (error) {
          const status = document.getElementById('gcodeStatus');
          if (status)
            status.textContent = `Settings not exported: ${error instanceof Error ? error.message : 'Invalid settings'}`;
        }
      });
    }

    setupImportSettings(el, UI, render, { ...layoutElements, pageEl, layoutState });

    pageEl.downloadSvg?.addEventListener('click', () => {
      flushRenders();
      const svg = pageEl.svgHost?.querySelector('svg');
      if (svg) downloadSvg(svg, createLayoutFilename(layoutElements), readExportScale());
    });
  }

  function bindLayoutControls(): void {
    const { pageInvert, nestingOffsetRow } = layoutElements;
    const refreshLayout = (paddingOnly = false) => {
      if (!paddingOnly && layoutElements.nesting) layoutElements.nesting.active = undefined;
      renderLayoutFn(lastPanel, lastDotSize, lastPanelConfig || undefined);
    };
    for (const [range, display] of layoutControlPairs(layoutElements)) {
      UI.syncPair(range, display, () => refreshLayout(range === layoutElements.pagePadding));
    }
    initializeEditableLayout(
      layoutElements,
      () => ({ panel: lastPanel, dot: lastDotSize }),
      () => renderLayoutFn(lastPanel, lastDotSize, lastPanelConfig || undefined),
    );
    pageInvert?.addEventListener('change', () => {
      if (layoutElements.nesting) layoutElements.nesting.active = undefined;
      const isInverted = pageInvert.checked;
      if (nestingOffsetRow) {
        if (isInverted) {
          nestingOffsetRow.classList.remove('hidden');
        } else {
          nestingOffsetRow.classList.add('hidden');
        }
      }
      renderLayoutFn(lastPanel, lastDotSize, lastPanelConfig || undefined);
    });

    if (pageInvert) {
      if (layoutElements.nesting) layoutElements.nesting.active = undefined;
      const isInverted = pageInvert.checked;
      if (nestingOffsetRow) {
        if (isInverted) {
          nestingOffsetRow.classList.remove('hidden');
        } else {
          nestingOffsetRow.classList.add('hidden');
        }
      }
    }

    pageEl.showGrid?.addEventListener('change', () =>
      renderLayoutFn(lastPanel, lastDotSize, lastPanelConfig || undefined),
    );

    const pageZoomCtl = UI.zoom;
    pageEl.zoom?.addEventListener('input', () => {
      pageZoomCtl.updateDisplay(pageEl);
      pageZoomCtl.apply(pageEl);
      requestAnimationFrame(() => updatePageOverflow(pageEl, layoutState));
    });
    pageEl.zoomIn?.addEventListener('click', () => pageZoomCtl.adjustBy(pageEl, 10));
    pageEl.zoomOut?.addEventListener('click', () => pageZoomCtl.adjustBy(pageEl, -10));
    pageEl.zoomReset?.addEventListener('click', () => {
      pageZoomCtl.setPct(pageEl, 100);
      requestAnimationFrame(() => updatePageOverflow(pageEl, layoutState));
    });

    // Reset layout settings button
    pageEl.resetLayoutSettings?.addEventListener('click', () => {
      resetLayoutSettings(
        { ...layoutElements, pageEl },
        renderLayoutFn,
        lastPanel,
        lastDotSize,
        lastPanelConfig || undefined,
      );
    });

    // Re-check overflow on plus/minus buttons which change zoom via CSS transform
    pageEl.zoomIn?.addEventListener('click', () =>
      requestAnimationFrame(() => updatePageOverflow(pageEl, layoutState)),
    );
    pageEl.zoomOut?.addEventListener('click', () =>
      requestAnimationFrame(() => updatePageOverflow(pageEl, layoutState)),
    );

    // Recompute on window resize
    window.addEventListener('resize', () =>
      requestAnimationFrame(() => updatePageOverflow(pageEl, layoutState)),
    );
  }

  UI.fixUiTextArtifacts();
  bindPanelControls();
  bindPanelPreview();
  bindExportControls();
  bindLayoutControls();
  UI.updateVisibility(el);

  const zoomControls = UI.zoom;
  zoomControls.setPct(el, 200);
  UI.zoom.setPct(pageEl, 100);

  render();

  initializeNesting(
    layoutElements,
    pageEl,
    () => ({ panel: lastPanel, config: lastPanelConfig, dot: lastDotSize }),
    flushRenders,
    () => renderLayoutFn(lastPanel, lastDotSize, lastPanelConfig || undefined),
  );
  initializeTooltips();
  initializeGcode(pageEl, flushRenders, () => {
    // Revalidate synchronously even when geometry/scale was edited in the same task.
    render();
    flushRenders();
  });
} // End of initializeApp

initializeApp();
