import type { Panel, DOMElements, PanelConfig } from './types';
import { createMainElements, createPageElements, getLayoutElements, validateCriticalElements } from './lib/dom';
import { renderLayout, updatePageOverflow, createMainRenderFunction } from './lib/renderer';
import { 
  resetPanelSettings, 
  resetLayoutSettings, 
  downloadSvg,
  createPanelFilename, 
  createLayoutFilename, 
  exportSettings, 
  setupImportSettings,
  setupHorizontalSpacingSync 
} from './lib/events';

import './lib/utils.js';
import './lib/constants.js';
import './lib/geometry.js';
import './lib/stitches.js';
import './lib/svg.js';
import './lib/state.js';
import './lib/ui.js';
import './lib/tooltips.js';

// Wait for FB modules to load
function waitForFB(): Promise<void> {
  return new Promise((resolve) => {
    if (window.FB && window.FB.CONSTANTS) {
      resolve();
    } else {
      const checkFB = () => {
        if (window.FB && window.FB.CONSTANTS) {
          resolve();
        } else {
          setTimeout(checkFB, 10);
        }
      };
      checkFB();
    }
  });
}

async function initializeApp() {
  await waitForFB();

const { PERFORMANCE } = window.FB.CONSTANTS;

const el: DOMElements = createMainElements();
const pageEl: DOMElements = createPageElements();
const layoutElements = getLayoutElements();

if (!validateCriticalElements(el)) {
  console.error('Critical DOM elements missing');
  return;
}

// Keep the most recent single-panel result for the layout preview
let lastPanel: Panel | null = null;
let lastDotSize: number = 1;
let lastPanelConfig: PanelConfig | null = null;
let layoutState = {
  lastLayoutWpx: 0,
  lastLayoutHpx: 0,
  isFirstLayoutRender: true
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

function debounce<T extends (...args: any[]) => any>(fn: T, ms: number): (...args: Parameters<T>) => void {
  let timeoutHandle: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => { 
    clearTimeout(timeoutHandle); 
    timeoutHandle = setTimeout(() => fn(...args), ms); 
  };
}

const debouncedRender = debounce(render, PERFORMANCE.DEBOUNCE_MS);

function bindUI(): void {
  const UI = window.FB.ui;
  if (!UI) return;
  
  UI.syncPair(el.side, el.sideNumber, debouncedRender);
  UI.syncPair(el.seam, el.seamNumber, debouncedRender);
  UI.syncPair(el.dotSize, el.dotSizeNumber, debouncedRender);
  
  if (el.cornerMargin && el.cornerMarginNumber) UI.syncPair(el.cornerMargin, el.cornerMarginNumber, debouncedRender);
  if (el.curveFactor && el.curveFactorNumber) UI.syncPair(el.curveFactor, el.curveFactorNumber, debouncedRender);
  if (el.stitches && el.stitchesNumber) UI.syncPair(el.stitches, el.stitchesNumber, debouncedRender);
  if (el.holeSpacing && el.holeSpacingNumber) UI.syncPair(el.holeSpacing, el.holeSpacingNumber, debouncedRender);
  if (el.hexLong && el.hexLongNumber) UI.syncPair(el.hexLong, el.hexLongNumber, debouncedRender);
  if (el.hexRatio && el.hexRatioNumber) UI.syncPair(el.hexRatio, el.hexRatioNumber, debouncedRender);

  const onShapeOrHexTypeChange = (): void => {
    UI.updateVisibility(el);
    debouncedRender();
  };
  
  el.shape?.addEventListener('change', onShapeOrHexTypeChange);
  el.curved?.addEventListener('change', () => {
    UI.updateVisibility(el);
    debouncedRender();
  });
  el.stitches?.addEventListener('input', debouncedRender);
  
  el.cornerMargin?.addEventListener('input', debouncedRender);
  el.holeSpacing?.addEventListener('input', debouncedRender);
  el.hexType?.addEventListener('change', onShapeOrHexTypeChange);
  el.side?.addEventListener('input', debouncedRender);
  el.hexLong?.addEventListener('input', debouncedRender);
  
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
    
  el.downloadSvg?.addEventListener('click', () => {
    const svg = el.svgHost?.querySelector('svg');
    if (!svg) return;
    downloadSvg(svg, createPanelFilename(el));
  });


  if (el.exportSettings) {
    el.exportSettings.addEventListener('click', () => exportSettings(el, { ...layoutElements, pageEl }));
  }
  
  setupImportSettings(el, UI, debouncedRender, { ...layoutElements, pageEl }, renderLayoutFn);

  el.resetPanelSettings?.addEventListener('click', () => {
    resetPanelSettings(el, UI, debouncedRender);
  });

  const { pageRows, pageRowsNumber, pageCols, pageColsNumber, pageHSpace, pageHSpaceNumber, 
          pageVSpace, pageVSpaceNumber, pageInvert, nestingOffset, nestingOffsetNumber, 
          nestingOffsetRow } = layoutElements;

  if (pageRows && pageRowsNumber) UI.syncPair(pageRows, pageRowsNumber, () => renderLayoutFn(lastPanel, lastDotSize, lastPanelConfig || undefined));
  if (pageCols && pageColsNumber) UI.syncPair(pageCols, pageColsNumber, () => renderLayoutFn(lastPanel, lastDotSize, lastPanelConfig || undefined));
  
  setupHorizontalSpacingSync({ pageHSpace, pageHSpaceNumber }, renderLayoutFn, () => lastPanel, () => lastDotSize);
  
  if (pageVSpace && pageVSpaceNumber) UI.syncPair(pageVSpace, pageVSpaceNumber, () => renderLayoutFn(lastPanel, lastDotSize, lastPanelConfig || undefined));
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
  
  if (nestingOffset && nestingOffsetNumber) UI.syncPair(nestingOffset, nestingOffsetNumber, () => renderLayoutFn(lastPanel, lastDotSize, lastPanelConfig || undefined));

  pageEl.showGrid?.addEventListener('change', () => renderLayoutFn(lastPanel, lastDotSize, lastPanelConfig || undefined));

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

  pageEl.downloadSvg?.addEventListener('click', () => {
    const svg = pageEl.svgHost?.querySelector('svg');
    if (!svg) return;
    downloadSvg(svg, createLayoutFilename(layoutElements));
  });

  // Reset layout settings button
  pageEl.resetLayoutSettings?.addEventListener('click', () => {
    resetLayoutSettings({ ...layoutElements, pageEl }, renderLayoutFn, lastPanel, lastDotSize, lastPanelConfig || undefined);
  });

  // Re-check overflow on plus/minus buttons which change zoom via CSS transform
  pageEl.zoomIn?.addEventListener('click', () => requestAnimationFrame(() => updatePageOverflow(pageEl, layoutState)));
  pageEl.zoomOut?.addEventListener('click', () => requestAnimationFrame(() => updatePageOverflow(pageEl, layoutState)));

  // Recompute on window resize
  window.addEventListener('resize', () => requestAnimationFrame(() => updatePageOverflow(pageEl, layoutState)));
}

window.FB.ui.fixUiTextArtifacts();
bindUI();
window.FB.ui.updateVisibility(el);

const zoomControls = window.FB.ui.zoom;
zoomControls.setPct(el, 200);
window.FB.ui.zoom.setPct(pageEl, 100);

render();

(window.FB as any).tooltips.initializeTooltips();

} // End of initializeApp

initializeApp();
