import type { Panel, PanelElements, PageElements, PanelConfig } from './types';
import { normalizeExportScale } from './lib/export';
import {
  createMainElements,
  createPageElements,
  getLayoutElements,
  validateCriticalElements,
} from './lib/dom';
import { renderLayout, updatePageOverflow, createMainRenderFunction } from './lib/renderer';
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
    isFirstLayoutRender: true,
  };

  function createLayoutRenderFunction() {
    return (panel: Panel | null, dotSize: number, config?: PanelConfig) => {
      lastPanel = panel;
      lastDotSize = dotSize;
      if (config) lastPanelConfig = config;
      renderLayout(panel, dotSize, pageEl, layoutElements, layoutState, lastPanelConfig);
      requestAnimationFrame(() => updatePageOverflow(pageEl, layoutState));
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
      render();
    });
  }

  function bindExportControls(): void {
    const readExportScale = (): number => {
      const scale = normalizeExportScale(el.exportScale?.value);
      if (el.exportScale) el.exportScale.value = String(scale);
      return scale;
    };
    el.exportScale?.addEventListener('change', readExportScale);

    el.downloadSvg?.addEventListener('click', () => {
      debouncedRender.flush();
      const svg = el.svgHost?.querySelector('svg');
      if (!svg) return;
      downloadSvg(svg, createPanelFilename(el), readExportScale());
    });

    if (el.exportSettings) {
      el.exportSettings.addEventListener('click', () => {
        debouncedRender.flush();
        exportSettings(el, { ...layoutElements, pageEl });
      });
    }

    setupImportSettings(el, UI, render, { ...layoutElements, pageEl, layoutState });

    pageEl.downloadSvg?.addEventListener('click', () => {
      debouncedRender.flush();
      const svg = pageEl.svgHost?.querySelector('svg');
      if (svg) downloadSvg(svg, createLayoutFilename(layoutElements), readExportScale());
    });
  }

  function bindLayoutControls(): void {
    const { pageInvert, nestingOffsetRow } = layoutElements;
    const refreshLayout = () =>
      renderLayoutFn(lastPanel, lastDotSize, lastPanelConfig || undefined);
    for (const [range, display] of layoutControlPairs(layoutElements)) {
      UI.syncPair(range, display, refreshLayout);
    }
    pageInvert?.addEventListener('change', () => {
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

  initializeTooltips();
} // End of initializeApp

initializeApp();
