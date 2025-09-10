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

// Secondary block: page layout preview elements
const pageEl: DOMElements = {
  shape: null,
  side: null,
  seam: null,
  curved: null,
  stitches: null,
  dotSize: null,
  svgHost: document.getElementById('pageSvgHost'),
  downloadSvg: document.getElementById('downloadPageSvg') as HTMLButtonElement,
  sideNumber: null,
  sideRow: null,
  seamNumber: null,
  curveFactorRow: null,
  curveFactor: null,
  curveFactorNumber: null,
  stitchesNumber: null,
  cornerMargin: null,
  cornerMarginNumber: null,
  holeSpacing: null,
  holeSpacingNumber: null,
  dotSizeNumber: null,
  hexTypeRow: null,
  hexLongRow: null,
  hexRatioRow: null,
  hexType: null,
  hexLong: null,
  hexLongNumber: null,
  hexRatio: null,
  hexRatioNumber: null,
  exportSettings: null,
  importSettings: null,
  importFile: null,
  zoom: document.getElementById('pageZoom') as HTMLInputElement,
  zoomIn: document.getElementById('pageZoomIn') as HTMLButtonElement,
  zoomOut: document.getElementById('pageZoomOut') as HTMLButtonElement,
  zoomReset: document.getElementById('pageZoomReset') as HTMLButtonElement,
  zoomLabel: document.getElementById('pageZoomLabel') as HTMLSpanElement,
  showGrid: document.getElementById('pageShowGrid') as HTMLInputElement,
};

// Page layout controls
const pageRows = document.getElementById('pageRows') as HTMLInputElement | null;
const pageRowsNumber = document.getElementById('pageRowsNumber') as HTMLInputElement | null;
const pageCols = document.getElementById('pageCols') as HTMLInputElement | null;
const pageColsNumber = document.getElementById('pageColsNumber') as HTMLInputElement | null;
const pageHSpace = document.getElementById('pageHSpace') as HTMLInputElement | null;
const pageHSpaceNumber = document.getElementById('pageHSpaceNumber') as HTMLInputElement | null;
const pageVSpace = document.getElementById('pageVSpace') as HTMLInputElement | null;
const pageVSpaceNumber = document.getElementById('pageVSpaceNumber') as HTMLInputElement | null;
const pageInvert = document.getElementById('pageInvert') as HTMLInputElement | null;
const nestingOffset = document.getElementById('nestingOffset') as HTMLInputElement | null;
const nestingOffsetNumber = document.getElementById('nestingOffsetNumber') as HTMLInputElement | null;
const nestingOffsetRow = document.getElementById('nestingOffsetRow') as HTMLElement | null;

const { clamp } = window.FB.utils;

const geometry = window.FB.geometry;

const stitchHelpers = window.FB.stitches;

// Keep the most recent single-panel result for the layout preview
let lastPanel: Panel | null = null;
let lastDotSize: number = 1;
let lastLayoutWpx = 0;
let lastLayoutHpx = 0;
let isFirstLayoutRender = true;

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
    
    // Rotate squares by 45 degrees to display as proper squares instead of diamonds
    if (nSides === 4) {
      const rotationAngle = Math.PI / 4; // 45 degrees in radians
      verts = verts.map(v => ({
        x: v.x * Math.cos(rotationAngle) - v.y * Math.sin(rotationAngle),
        y: v.x * Math.sin(rotationAngle) + v.y * Math.cos(rotationAngle)
      }));
    }
    
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
    
    // Rotate squares by 45 degrees to display as proper squares instead of diamonds
    if (nSides === 4) {
      const rotationAngle = Math.PI / 4; // 45 degrees in radians
      verts = verts.map(v => ({
        x: v.x * Math.cos(rotationAngle) - v.y * Math.sin(rotationAngle),
        y: v.x * Math.sin(rotationAngle) + v.y * Math.cos(rotationAngle)
      }));
    }
    
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

// Build a sheet layout composed of multiple copies of the current panel
function createLayoutSvg(
  panel: Panel,
  opts: { rows: number; cols: number; hSpace: number; vSpace: number; dotDiameter: number; showGrid: boolean; invertOdd: boolean; nestingVerticalOffset: number }
): SVGElement {
  const { rows, cols, hSpace, vSpace, dotDiameter, showGrid, invertOdd, nestingVerticalOffset } = opts;
  const { COLORS, STROKES, LAYOUT } = window.FB.CONSTANTS;

  // Use the panel's tight bounds (without the per-panel margin) so spacing=0
  // produces a snug, waste-minimizing layout.
  const margin = LAYOUT.MARGIN_MM;
  const cellW = Math.max(0, panel.bounds.width - 2 * margin);
  const cellH = Math.max(0, panel.bounds.height - 2 * margin);
  const width = cols * cellW + (cols - 1) * hSpace;
  let height = rows * cellH + (rows - 1) * vSpace;
  
  // Adjust height to account for nesting vertical offset when inverted
  if (invertOdd && nestingVerticalOffset !== 0) {
    height += Math.abs(nestingVerticalOffset);
  }

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', `${width}mm`);
  svg.setAttribute('height', `${height}mm`);
  
  // Adjust viewBox to account for negative vertical offset
  let viewBoxY = 0;
  if (invertOdd && nestingVerticalOffset < 0) {
    viewBoxY = nestingVerticalOffset;
  }
  svg.setAttribute('viewBox', `0 ${viewBoxY.toFixed(3)} ${width.toFixed(3)} ${height.toFixed(3)}`);
  svg.setAttribute('fill', 'none');
  svg.style.background = 'white';

  // Optional sheet grid
  const grid = document.createElementNS(svg.namespaceURI, 'g');
  grid.setAttribute('id', 'grid');
  grid.setAttribute('stroke', '#bfbfbf');
  grid.setAttribute('stroke-width', '0.1mm');
  grid.setAttribute('opacity', '0.22');
  const gridSpacing = LAYOUT.GRID_SPACING_MM;
  for (let x = 0; x <= width; x += gridSpacing) {
    const l = document.createElementNS(svg.namespaceURI, 'line');
    l.setAttribute('x1', x.toFixed(3));
    l.setAttribute('y1', viewBoxY.toFixed(3));
    l.setAttribute('x2', x.toFixed(3));
    l.setAttribute('y2', (viewBoxY + height).toFixed(3));
    grid.appendChild(l);
  }
  const gridStartY = Math.floor(viewBoxY / gridSpacing) * gridSpacing;
  const gridEndY = viewBoxY + height;
  for (let y = gridStartY; y <= gridEndY; y += gridSpacing) {
    const l = document.createElementNS(svg.namespaceURI, 'line');
    l.setAttribute('x1', '0');
    l.setAttribute('y1', y.toFixed(3));
    l.setAttribute('x2', width.toFixed(3));
    l.setAttribute('y2', y.toFixed(3));
    grid.appendChild(l);
  }
  svg.appendChild(grid);
  if (!showGrid) grid.setAttribute('style', 'display:none');

  // Translation to align panel's local coords (which include viewMin offsets)
  // Translate so that the panel's content minX/minY (excluding margin) sits at (0,0)
  const dx0 = -(panel.bounds.viewMinX + margin);
  const dy0 = -(panel.bounds.viewMinY + margin);
  const r = Math.max(0.1, dotDiameter / 2);

  for (let ri = 0; ri < rows; ri++) {
    for (let ci = 0; ci < cols; ci++) {
      const offX = ci * (cellW + hSpace) + dx0;
      const offY = ri * (cellH + vSpace) + dy0;
      // Cell container at cell origin
      const gCell = document.createElementNS(svg.namespaceURI, 'g');
      gCell.setAttribute('transform', `translate(${offX.toFixed(3)} ${offY.toFixed(3)})`);
      // Inner group for optional flip within the cell box
      const g = document.createElementNS(svg.namespaceURI, 'g');
      if (invertOdd && (ci % 2 === 1)) {
        // Flip vertically within the panel's own coordinate space
        // The panel spans from viewMinY to viewMinY + height
        // We want to flip around the center: (viewMinY + viewMaxY) / 2
        const panelMinY = panel.bounds.viewMinY;
        const panelMaxY = panelMinY + panel.bounds.height;
        const flipCenter = (panelMinY + panelMaxY) / 2;
        // y' = -y + 2*center + offset  -> vertical mirror around the center line plus offset
        const flipAndOffset = 2 * flipCenter + nestingVerticalOffset;
        g.setAttribute('transform', `matrix(1 0 0 -1 0 ${flipAndOffset.toFixed(3)})`);
      }

      const path = document.createElementNS(svg.namespaceURI, 'path');
      path.setAttribute('d', panel.outlinePath);
      path.setAttribute('stroke', COLORS.cut);
      path.setAttribute('stroke-width', `${STROKES.cut}mm`);
      path.setAttribute('fill', 'none');
      g.appendChild(path);

      const marks = document.createElementNS(svg.namespaceURI, 'g');
      marks.setAttribute('fill', COLORS.seam);
      for (const p of panel.stitches) {
        const c = document.createElementNS(svg.namespaceURI, 'circle');
        c.setAttribute('cx', p.x.toFixed(3));
        c.setAttribute('cy', p.y.toFixed(3));
        c.setAttribute('r', r.toFixed(3));
        c.setAttribute('fill', COLORS.seam);
        marks.appendChild(c);
      }
      g.appendChild(marks);
      gCell.appendChild(g);
      svg.appendChild(gCell);
    }
  }
  return svg;
}

function renderLayout(panel: Panel | null, dotDiameter: number): void {
  if (!pageEl.svgHost) return;
  if (!panel) { pageEl.svgHost.innerHTML = ''; return; }
  const rows = pageRows ? Math.max(1, Math.min(50, parseInt(pageRows.value || '3', 10))) : 3;
  const cols = pageCols ? Math.max(1, Math.min(50, parseInt(pageCols.value || '3', 10))) : 3;
  
  // Get horizontal spacing from the number input (which shows the actual value)
  const hSpace = pageHSpaceNumber ? parseFloat(pageHSpaceNumber.value || '0') : 0;
  
  const vSpace = pageVSpace ? Math.max(0, parseFloat(pageVSpace.value || '10')) : 10;
  const showGrid = !!(pageEl.showGrid && pageEl.showGrid.checked);
  const invertOdd = !!(pageInvert && pageInvert.checked);
  const nestingVerticalOffset = nestingOffset ? parseFloat(nestingOffset.value || '0') : 0;

  // Compute if we need to auto-fit to the host viewport
  const MM_TO_PX = 96 / 25.4;
  const margin = LAYOUT.MARGIN_MM;
  const cellW = Math.max(0, panel.bounds.width - 2 * margin);
  const cellH = Math.max(0, panel.bounds.height - 2 * margin);
  const layoutWmm = cols * cellW + (cols - 1) * hSpace;
  const layoutHmm = rows * cellH + (rows - 1) * vSpace;
  const layoutWpx = layoutWmm * MM_TO_PX;
  const layoutHpx = layoutHmm * MM_TO_PX;
  lastLayoutWpx = layoutWpx;
  lastLayoutHpx = layoutHpx;
  const hostW = pageEl.svgHost.clientWidth || 1;
  const hostH = pageEl.svgHost.clientHeight || 1;
  const needsFit = layoutWpx > hostW || layoutHpx > hostH;
  const rawFitPct = Math.min(hostW / layoutWpx, hostH / layoutHpx) * 100;
  const fitPct = Math.max(20, Math.min(300, Math.floor(rawFitPct) - 1));

  pageEl.svgHost.innerHTML = '';
  const svg = createLayoutSvg(panel, { rows, cols, hSpace, vSpace, dotDiameter, showGrid, invertOdd, nestingVerticalOffset });
  const wrap = document.createElement('div');
  wrap.className = 'svg-wrap';
  wrap.appendChild(svg);
  pageEl.svgHost.appendChild(wrap);
  const currentPct = window.FB.ui?.zoom?.getPct(pageEl) || 100;
  if (isFirstLayoutRender) {
    // Keep user's/default 100% on first load; no auto-shrink
    window.FB.ui?.zoom?.apply(pageEl);
    window.FB.ui?.zoom?.updateDisplay(pageEl);
    isFirstLayoutRender = false;
  } else if (needsFit && currentPct > fitPct) {
    // Only shrink if needed to fit
    window.FB.ui?.zoom?.setPct(pageEl, fitPct);
  } else {
    window.FB.ui?.zoom?.apply(pageEl);
    window.FB.ui?.zoom?.updateDisplay(pageEl);
  }

  requestAnimationFrame(() => updatePageOverflow());
}

function updatePageOverflow(): void {
  if (!pageEl.svgHost) return;
  const host = pageEl.svgHost as HTMLElement;
  const hostW = host.clientWidth || 1;
  const hostH = host.clientHeight || 1;
  const scale = (window.FB.ui?.zoom?.getPct(pageEl) || 100) / 100;
  const visW = lastLayoutWpx * scale;
  const visH = lastLayoutHpx * scale;
  const tol = Math.max(10, Math.round(6 * (window.devicePixelRatio || 1))); // px
  host.style.overflowX = (visW <= hostW + tol) ? 'hidden' : 'auto';
  host.style.overflowY = (visH <= hostH + tol) ? 'hidden' : 'auto';
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
    lastPanel = panel;
    lastDotSize = config.dotSize;
    renderLayout(lastPanel, lastDotSize);
    
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
  el.zoomIn?.addEventListener('click', () => zoomControls.adjustBy(el, 10));
  el.zoomOut?.addEventListener('click', () => zoomControls.adjustBy(el, -10));
  el.zoomReset?.addEventListener('click', () => zoomControls.setPct(el, 200));

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

  // Bind layout (page) controls
  const UIpage = window.FB.ui;
  if (pageRows && pageRowsNumber) UIpage.syncPair(pageRows, pageRowsNumber, () => renderLayout(lastPanel, lastDotSize));
  if (pageCols && pageColsNumber) UIpage.syncPair(pageCols, pageColsNumber, () => renderLayout(lastPanel, lastDotSize));
  
  // Custom sync for horizontal spacing with negative value mapping
  if (pageHSpace && pageHSpaceNumber) {
    const syncHSpaceFromSlider = () => {
      const sliderVal = parseInt(pageHSpace.value, 10);
      // Map slider: 0-20 → -20 to 0mm, 21-70 → 1 to 50mm
      const actualVal = sliderVal <= 20 ? (sliderVal - 20) : (sliderVal - 19);
      pageHSpaceNumber.value = actualVal.toString();
      renderLayout(lastPanel, lastDotSize);
    };
    
    const syncHSpaceFromNumber = () => {
      const numberVal = parseInt(pageHSpaceNumber.value, 10);
      // Map number: -20 to 0mm → 0-20 slider, 1 to 50mm → 21-70 slider
      const sliderVal = numberVal <= 0 ? (numberVal + 20) : (numberVal + 19);
      pageHSpace.value = Math.max(0, Math.min(70, sliderVal)).toString();
      renderLayout(lastPanel, lastDotSize);
    };
    
    pageHSpace.addEventListener('input', syncHSpaceFromSlider);
    pageHSpaceNumber.addEventListener('input', syncHSpaceFromNumber);
    
    // Initialize the display
    syncHSpaceFromSlider();
  }
  
  if (pageVSpace && pageVSpaceNumber) UIpage.syncPair(pageVSpace, pageVSpaceNumber, () => renderLayout(lastPanel, lastDotSize));
  pageInvert?.addEventListener('change', () => {
    const isInverted = pageInvert.checked;
    if (nestingOffsetRow) {
      if (isInverted) {
        nestingOffsetRow.classList.remove('hidden');
      } else {
        nestingOffsetRow.classList.add('hidden');
      }
    }
    renderLayout(lastPanel, lastDotSize);
  });
  
  // Initialize nesting control visibility
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
  
  if (nestingOffset && nestingOffsetNumber) UIpage.syncPair(nestingOffset, nestingOffsetNumber, () => renderLayout(lastPanel, lastDotSize));

  pageEl.showGrid?.addEventListener('change', () => renderLayout(lastPanel, lastDotSize));

  const pageZoomCtl = UIpage.zoom;
  pageEl.zoom?.addEventListener('input', () => { pageZoomCtl.updateDisplay(pageEl); pageZoomCtl.apply(pageEl); requestAnimationFrame(() => updatePageOverflow()); });
  pageEl.zoomIn?.addEventListener('click', () => pageZoomCtl.adjustBy(pageEl, 10));
  pageEl.zoomOut?.addEventListener('click', () => pageZoomCtl.adjustBy(pageEl, -10));
  pageEl.zoomReset?.addEventListener('click', () => { pageZoomCtl.setPct(pageEl, 100); requestAnimationFrame(() => updatePageOverflow()); });

  pageEl.downloadSvg?.addEventListener('click', () => {
    const svg = pageEl.svgHost?.querySelector('svg');
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGElement;
    clone.style.background = 'white';
    
    // Remove grid from export if it's disabled in the viewer
    const showGrid = !!(pageEl.showGrid && pageEl.showGrid.checked);
    if (!showGrid) {
      const grid = clone.querySelector('#grid');
      if (grid) {
        grid.remove();
      }
    }
    
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `footbag-layout-${(pageRows?.value || '3')}x${(pageCols?.value || '3')}.svg`;
    a.href = url;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  // Re-check overflow on plus/minus buttons which change zoom via CSS transform
  pageEl.zoomIn?.addEventListener('click', () => requestAnimationFrame(() => updatePageOverflow()));
  pageEl.zoomOut?.addEventListener('click', () => requestAnimationFrame(() => updatePageOverflow()));

  // Recompute on window resize
  window.addEventListener('resize', () => requestAnimationFrame(() => updatePageOverflow()));
}

const debouncedRender = debounce(render, PERFORMANCE.DEBOUNCE_MS);

window.FB.ui.fixUiTextArtifacts();
bindUI();
window.FB.ui.updateVisibility(el);

const zoomControls = window.FB.ui.zoom;
zoomControls.setPct(el, 200);

// Initialize layout preview zoom as well (100%)
window.FB.ui.zoom.setPct(pageEl, 100);

render();

(window.FB as any).tooltips.initializeTooltips();

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
