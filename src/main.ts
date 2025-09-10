// Footbag Panel Generator - MVP
// - Curved polygon panel (3-6 sides)
// - Seam allowance visualization (polyline approx)
// - Stitch marks at seam offset
// - SVG preview + download

import type { 
  Point, 
  Panel, 
  PanelConfig, 
  GeometryConfig, 
  GeometryResult, 
  UIConfig, 
  DOMElements 
} from './types';

// Import the TypeScript modules
import './lib/utils.js';
import './lib/constants.js';
import './lib/geometry.js';
import './lib/stitches.js';
import './lib/svg.js';
import './lib/state.js';
import './lib/ui.js';

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

const { CURVATURE, SAMPLING, LAYOUT, PERFORMANCE } = window.FB.CONSTANTS;

function showErrorMessage(message: string): void {
  if (el.svgHost) {
    el.svgHost.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #ff6b6b; background: #2a2a2a; border-radius: 8px; margin: 10px;">
        <h3>⚠️ Error</h3>
        <p>${message}</p>
        <p><small>Please refresh the page and try again.</small></p>
      </div>
    `;
  }
}

const el: DOMElements = {
  shape: document.getElementById('shape') as HTMLSelectElement,
  side: document.getElementById('side') as HTMLInputElement,
  seam: document.getElementById('seam') as HTMLInputElement,
  curved: document.getElementById('curved') as HTMLInputElement,
  stitches: document.getElementById('stitches') as HTMLInputElement,
  dotSize: document.getElementById('dotSize') as HTMLInputElement,
  svgHost: document.getElementById('svgHost'),
  downloadSvg: document.getElementById('downloadSvg') as HTMLButtonElement,
  
  sideNumber: document.getElementById('sideNumber') as HTMLSpanElement,
  sideRow: document.getElementById('sideRow'),
  seamNumber: document.getElementById('seamNumber') as HTMLSpanElement,
  curveFactorRow: document.getElementById('curveFactorRow'),
  curveFactor: document.getElementById('curveFactor') as HTMLInputElement,
  curveFactorNumber: document.getElementById('curveFactorNumber') as HTMLSpanElement,
  stitchesNumber: document.getElementById('stitchesNumber') as HTMLSpanElement,
  cornerMargin: document.getElementById('cornerMargin') as HTMLInputElement,
  cornerMarginNumber: document.getElementById('cornerMarginNumber') as HTMLSpanElement,
  holeSpacing: document.getElementById('holeSpacing') as HTMLInputElement,
  holeSpacingNumber: document.getElementById('holeSpacingNumber') as HTMLSpanElement,
  dotSizeNumber: document.getElementById('dotSizeNumber') as HTMLSpanElement,
  
  hexTypeRow: document.getElementById('hexTypeRow'),
  hexLongRow: document.getElementById('hexLongRow'),
  hexRatioRow: document.getElementById('hexRatioRow'),
  hexType: document.getElementById('hexType') as HTMLSelectElement,
  hexLong: document.getElementById('hexLong') as HTMLInputElement,
  hexLongNumber: document.getElementById('hexLongNumber') as HTMLSpanElement,
  hexRatio: document.getElementById('hexRatio') as HTMLInputElement,
  hexRatioNumber: document.getElementById('hexRatioNumber') as HTMLSpanElement,
  
  exportSettings: document.getElementById('exportSettings') as HTMLButtonElement,
  importSettings: document.getElementById('importSettings') as HTMLButtonElement,
  importFile: document.getElementById('importFile') as HTMLInputElement,
  
  zoom: document.getElementById('zoom') as HTMLInputElement,
  zoomIn: document.getElementById('zoomIn') as HTMLButtonElement,
  zoomOut: document.getElementById('zoomOut') as HTMLButtonElement,
  zoomReset: document.getElementById('zoomReset') as HTMLButtonElement,
  zoomLabel: document.getElementById('zoomLabel') as HTMLSpanElement,
  showGrid: document.getElementById('showGrid') as HTMLInputElement,
};

// Check for critical missing elements
if (!el.shape || !el.side || !el.seam || !el.curved || !el.stitches || !el.dotSize || !el.svgHost) {
  console.error('Critical DOM elements missing');
}

const { clamp } = window.FB.utils;

const geometry = window.FB.geometry;

const stitchHelpers = window.FB.stitches;

// Utility function for edge arc length calculation (currently unused)
// function edgeArcLength(verts: Point[], depth: number, samplesPerEdge: number = SAMPLING.ARC_LENGTH_SAMPLES): { lens: number[]; total: number } {
//   const numVertices = verts.length;
//   const lens: number[] = [];
//   let total = 0;
//   for (let edgeIndex = 0; edgeIndex < numVertices; edgeIndex++) {
//     const startVertex = verts[edgeIndex];
//     const endVertex = verts[(edgeIndex + 1) % numVertices];
//     const samples = geometry.approxEdgeSamples(startVertex, endVertex, depth, samplesPerEdge);
//     let len = 0;
//     for (let sampleIndex = 1; sampleIndex < samples.length; sampleIndex++) {
//       const prevPoint = samples[sampleIndex - 1].p;
//       const currentPoint = samples[sampleIndex].p;
//       len += Math.hypot(currentPoint.x - prevPoint.x, currentPoint.y - prevPoint.y);
//     }
//     lens.push(len);
//     total += len;
//   }
//   return { lens, total };
// }

function computePanel(params: PanelConfig): Panel {
  const { nSides, sideLen, seamOffset, stitchCount, curvedEdges, hexType = 'regular', hexLong = 30, hexRatio = 0.5, curveFactor, holeSpacing, cornerMargin } = params;
  let verts: Point[];
  let curveScaleR: number;
  let edgeInclude: ((i: number) => boolean) | null = null;

  if (nSides === 6 && hexType === 'truncated') {
    const longSideLength = hexLong;
    const shortSideLength = INPUT_VALIDATORS.hexRatio(hexRatio) * longSideLength;
    verts = geometry.truncatedHexagonVertices(longSideLength, shortSideLength);
    let sumr = 0;
    for (const v of verts) sumr += Math.hypot(v.x, v.y);
    curveScaleR = (sumr / verts.length) || longSideLength;
    edgeInclude = (i: number) => i % 2 === 0;
  } else {
    const circumRadius = sideLen / (2 * Math.sin(Math.PI / nSides));
    verts = geometry.regularPolygonVertices(nSides, circumRadius);
    curveScaleR = circumRadius;
  }

  const factor = curvedEdges ? (Number.isFinite(curveFactor) ? curveFactor : (CURVATURE[nSides] || 0.3)) : 0;
  const curveDepth = curvedEdges ? curveScaleR * factor : 0;
  const outlinePath = geometry.quadraticCurvePath(verts, curveDepth);
  const stitches = stitchHelpers.stitchPositions(verts, curveDepth, stitchCount, seamOffset, holeSpacing, cornerMargin, SAMPLING.EDGE_SAMPLES_HIGH_PRECISION, edgeInclude);
  const allX: number[] = [];
  const allY: number[] = [];
  for (let vertexIndex = 0; vertexIndex < verts.length; vertexIndex++) {
    const startVertex = verts[vertexIndex]; const endVertex = verts[(vertexIndex + 1) % verts.length];
    const seg = geometry.approxEdgeSamples(startVertex, endVertex, curveDepth, SAMPLING.BOUNDS_SAMPLES);
    for (const s of seg) { allX.push(s.p.x); allY.push(s.p.y); }
  }
  for (const p of stitches) { allX.push(p.x); allY.push(p.y); }
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);
  const margin = LAYOUT.MARGIN_MM;
  const width = (maxX - minX) + margin * 2;
  const height = (maxY - minY) + margin * 2;
  const viewMinX = minX - margin;
  const viewMinY = minY - margin;
  return { outlinePath, stitches, bounds: { viewMinX, viewMinY, width, height } };
}

const SVG = window.FB.svg;

type ValidatorFunction = (value: string | number, max?: number) => number;

const INPUT_VALIDATORS: Record<string, ValidatorFunction> = {
  side: (value: string | number) => clamp(parseFloat(value.toString()), 10, 80),
  seam: (value: string | number) => clamp(parseFloat(value.toString()), 2, 9),
  hexLong: (value: string | number) => clamp(parseFloat(value.toString()), 10, 80),
  hexRatio: (value: string | number) => clamp(parseFloat(value.toString()), 0.1, 0.9),
  curveFactor: (value: string | number) => clamp(parseFloat(value.toString()), 0.10, 0.40),
  cornerMargin: (value: string | number, max: number = 100) => clamp(parseFloat(value.toString()), 0, Math.max(0, max)),
  holeSpacing: (value: string | number, max: number = 100) => clamp(parseFloat(value.toString()), 1, max),
  dotSize: (value: string | number) => clamp(parseFloat(value.toString()), 0.2, 1.5),
};

/**
 * Collects and validates all input values from the UI
 */
function collectInputValues(): UIConfig {
  const nSides = parseInt(el.shape?.value ?? '5', 10);
  const side = INPUT_VALIDATORS.side(el.side?.value ?? '30');
  const seam = INPUT_VALIDATORS.seam(el.seam?.value ?? '5');
  const stitches = parseInt(el.stitches?.value ?? '10', 10);
  const curvedEdges = el.curved?.checked ?? false;
  const hexType = el.hexType?.value ?? 'regular';
  const hexLong = el.hexLong ? INPUT_VALIDATORS.hexLong(el.hexLong.value) : 30;
  const hexRatio = el.hexRatio ? INPUT_VALIDATORS.hexRatio(el.hexRatio.value) : 0.5;
  const curveFactor = el.curveFactor ? 
    INPUT_VALIDATORS.curveFactor(el.curveFactor.value) : 
    (CURVATURE[nSides] || 0.3);
  const dotSize = INPUT_VALIDATORS.dotSize(el.dotSize?.value ?? '1');

  return {
    nSides,
    side,
    seam,
    stitches,
    curvedEdges,
    hexType,
    hexLong,
    hexRatio,
    curveFactor,
    dotSize,
  };
}

/**
 * Computes geometry parameters based on input configuration
 */
function computeGeometry(config: GeometryConfig): GeometryResult {
  const { nSides, side, hexType, hexLong, hexRatio } = config;
  
  let verts: Point[];
  let curveScaleR: number;
  let edgeInclude: ((i: number) => boolean) | null = null;
  
  if (nSides === 6 && hexType === 'truncated') {
    const longSideLength = hexLong;
    const shortSideLength = INPUT_VALIDATORS.hexRatio(hexRatio) * longSideLength;
    verts = geometry.truncatedHexagonVertices(longSideLength, shortSideLength);
    let sumr = 0;
    for (const v of verts) sumr += Math.hypot(v.x, v.y);
    curveScaleR = (sumr / verts.length) || longSideLength;
    edgeInclude = (i: number) => i % 2 === 0;
  } else {
    const circumRadius = side / (2 * Math.sin(Math.PI / nSides));
    verts = geometry.regularPolygonVertices(nSides, circumRadius);
    curveScaleR = circumRadius;
  }
  
  return { verts, curveScaleR, edgeInclude };
}

/**
 * Updates dynamic UI constraints based on current geometry
 */
function updateDynamicConstraints(config: UIConfig, geometry: GeometryResult): { cornerMargin: number; holeSpacing: number } {
  const { nSides, hexType, hexLong, side, stitches, curvedEdges, curveFactor } = config;
  const { verts, curveScaleR, edgeInclude } = geometry;
  
  const cornerMax = (nSides === 6 && hexType === 'truncated') ? (hexLong / 4) : (side / 4);
  if (el.cornerMargin) {
    const cmMaxStr = String(Math.max(0, Math.round(cornerMax * 10) / 10));
    el.cornerMargin.max = cmMaxStr;
    el.cornerMarginNumber?.setAttribute('max', cmMaxStr);
  }
  
  const cornerMargin = el.cornerMargin ? 
    INPUT_VALIDATORS.cornerMargin(el.cornerMargin.value, cornerMax) : 2;
  
  const depth = curvedEdges ? curveScaleR * curveFactor : 0;
  const allowableSpacing = stitchHelpers.computeAllowableSpacing(
    verts, depth, stitches, cornerMargin, 
    SAMPLING.EDGE_SAMPLES_HIGH_PRECISION, edgeInclude
  );
  
  if (el.holeSpacing) {
    const maxStr = String(Math.max(1, Math.round(allowableSpacing * 10) / 10));
    el.holeSpacing.max = maxStr;
    el.holeSpacingNumber?.setAttribute('max', maxStr);
  }
  
  const holeSpacing = el.holeSpacing ? 
    INPUT_VALIDATORS.holeSpacing(el.holeSpacing.value, allowableSpacing) : 5;
  
  return { cornerMargin, holeSpacing };
}

/**
 * Renders the SVG to the DOM
 */
function renderSVGToDOM(panel: Panel, dotDiameter: number): void {
  if (!el.svgHost) {
    console.error('SVG host element not available');
    return;
  }
  
  el.svgHost.innerHTML = '';
  
  const svg = SVG.createSvg(panel, { dotDiameter });
  
  svg.style.maxWidth = '100%';
  svg.style.height = 'auto';
  
  const wrap = document.createElement('div');
  wrap.className = 'svg-wrap';
  wrap.appendChild(svg);
  el.svgHost.appendChild(wrap);
  
  window.FB.ui?.zoom?.apply(el);
  if (typeof applyGridVisibility === 'function') {
    applyGridVisibility();
  }
}

/**
 * Main render function - orchestrates the entire rendering pipeline
 */
function render(): void {
  try {
    const config = collectInputValues();
    
    const geometryResult = computeGeometry(config);
    
    const { cornerMargin, holeSpacing } = updateDynamicConstraints(config, geometryResult);
    
    const panelConfig: PanelConfig = {
      nSides: config.nSides,
      sideLen: config.side,
      seamOffset: config.seam,
      stitchCount: config.stitches,
      curvedEdges: config.curvedEdges,
      hexType: config.hexType as 'regular' | 'truncated',
      hexLong: config.hexLong,
      hexRatio: config.hexRatio,
      curveFactor: config.curveFactor,
      holeSpacing,
      cornerMargin,
    };
    
    const panel = computePanel(panelConfig);
    
    renderSVGToDOM(panel, config.dotSize);
    
  } catch (error) {
    console.error('Render error:', error);
    showErrorMessage('Unable to generate footbag panel. Please refresh and try again.');
  }
}

function debounce<T extends (...args: any[]) => any>(fn: T, ms: number): (...args: Parameters<T>) => void {
  let timeoutHandle: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => { 
    clearTimeout(timeoutHandle); 
    timeoutHandle = setTimeout(() => fn(...args), ms); 
  };
}

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
  el.zoomIn?.addEventListener('click', () => zoomControls.adjustBy(el, 5));
  el.zoomOut?.addEventListener('click', () => zoomControls.adjustBy(el, -5));
  el.zoomReset?.addEventListener('click', () => zoomControls.setPct(el, 100));

  el.showGrid?.addEventListener('change', () => {
    if (typeof applyGridVisibility === 'function') {
      applyGridVisibility();
    }
  });
    
  el.downloadSvg?.addEventListener('click', () => {
    const svg = el.svgHost?.querySelector('svg');
    if (!svg) return;
    
    const clone = svg.cloneNode(true) as SVGElement;
    clone.style.background = 'white';
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    const shapeBase = {3:'tri',4:'sq',5:'penta',6:'hexa'}[parseInt(el.shape?.value ?? '5', 10)] || 'panel';
    const useTrunc = (parseInt(el.shape?.value ?? '5', 10) === 6 && el.hexType?.value === 'truncated');
    const shapeLabel = useTrunc ? `${shapeBase}-trunc` : shapeBase;
    const sizeLabel = useTrunc ? 
      `${el.hexLong?.value ?? '30'}mmL-${el.hexRatio?.value ?? '0.5'}r` : 
      `${el.side?.value ?? '30'}mm-side`;
    downloadLink.download = `footbag-${shapeLabel}-${sizeLabel}-${el.stitches?.value ?? '10'}st-${el.curved?.checked ? 'curved' : 'straight'}.svg`;
    downloadLink.href = url;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    URL.revokeObjectURL(url);
  });

  const STATE = window.FB.state;
  if (el.exportSettings && STATE) {
    el.exportSettings.addEventListener('click', () => {
      const settings = STATE.collect(el);
      const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      const shapeBase = {3:'tri',4:'sq',5:'penta',6:'hexa'}[parseInt(el.shape?.value ?? '5', 10)] || 'panel';
      const ts = new Date().toISOString().replace(/[:.]/g,'-');
      downloadLink.download = `footbag-${shapeBase}-settings-${ts}.json`;
      downloadLink.href = url;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      URL.revokeObjectURL(url);
    });
  }
  
  if (el.importSettings && el.importFile && STATE) {
    el.importSettings.addEventListener('click', () => el.importFile?.click());
    el.importFile.addEventListener('change', () => {
      const file = el.importFile!.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result || '{}'));
          STATE.apply(el, data);
          UI.updateVisibility(el);
          debouncedRender();
        } catch (e) {
          alert('Invalid settings file.');
        }
        el.importFile!.value = '';
      };
      reader.readAsText(file);
    });
  }
}

// Legacy visibility function - now handled by window.FB.ui.updateVisibility
// function updateVisibility(): void {
//   const isHex = parseInt(el.shape!.value, 10) === 6;
//   const isTrunc = isHex && el.hexType && el.hexType.value === 'truncated';
//   if (el.hexTypeRow) el.hexTypeRow.classList.toggle('hidden', !isHex);
//   if (el.hexLongRow) el.hexLongRow.classList.toggle('hidden', !isTrunc);
//   if (el.hexRatioRow) el.hexRatioRow.classList.toggle('hidden', !isTrunc);
//   if (el.sideRow) el.sideRow.classList.toggle('hidden', !!isTrunc);
//   const curvedOn = !!(el.curved && el.curved.checked);
//   if (el.curveFactorRow) el.curveFactorRow.classList.toggle('hidden', !curvedOn);
// }

const debouncedRender = debounce(render, PERFORMANCE.DEBOUNCE_MS);

window.FB.ui.fixUiTextArtifacts();
bindUI();
window.FB.ui.updateVisibility(el);
render();

function applyGridVisibility(): void {
  const svg = el.svgHost!.querySelector('svg');
  if (!svg) return;
  const grid = svg.querySelector('#grid');
  if (!grid) return;
  if (el.showGrid && !el.showGrid.checked) {
    grid.setAttribute('style', 'display:none');
  } else {
    grid.removeAttribute('style');
  }
}

} // End of initializeApp

// Initialize the application
initializeApp();
