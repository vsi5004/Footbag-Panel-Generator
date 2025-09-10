// Rendering system for the footbag panel generator
// Handles SVG rendering to DOM and render pipeline coordination

import type { Panel, PanelConfig } from '../types';
import { collectInputValues, computeGeometry, updateDynamicConstraints, createPanelConfig } from './validation';
import { createLayoutSvg, calculateMaterialUtilization } from './layout';

/**
 * Computes a panel from the given configuration
 */
export function computePanel(params: PanelConfig): Panel {
  const { nSides, sideLen, seamOffset, stitchCount, curvedEdges, hexType = 'regular', hexLong = 30, hexRatio = 0.5, curveFactor, holeSpacing, cornerMargin } = params;
  const { geometry, stitches: stitchHelpers } = window.FB;
  const { CURVATURE, SAMPLING, LAYOUT } = window.FB.CONSTANTS;
  
  let verts: any[];
  let curveScaleR: number;
  let edgeInclude: ((i: number) => boolean) | null = null;

  if (nSides === 6 && hexType === 'truncated') {
    const longSideLength = hexLong;
    const shortSideLength = hexRatio * longSideLength;
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
      verts = verts.map((v: any) => ({
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
    const startVertex = verts[vertexIndex]; 
    const endVertex = verts[(vertexIndex + 1) % verts.length];
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

/**
 * Renders the SVG to the DOM
 */
export function renderSVGToDOM(panel: Panel, dotDiameter: number, el: any): void {
  if (!el.svgHost) {
    console.error('SVG host element not available');
    return;
  }
  
  el.svgHost.innerHTML = '';
  
  const svg = window.FB.svg.createSvg(panel, { dotDiameter });
  
  svg.style.maxWidth = '100%';
  svg.style.height = 'auto';
  
  const wrap = document.createElement('div');
  wrap.className = 'svg-wrap';
  wrap.appendChild(svg);
  el.svgHost.appendChild(wrap);
  
  window.FB.ui?.zoom?.apply(el);
}

/**
 * Renders the layout preview
 */
export function renderLayout(
  panel: Panel | null, 
  dotDiameter: number, 
  pageEl: any, 
  layoutElements: any,
  state: { lastLayoutWpx: number; lastLayoutHpx: number; isFirstLayoutRender: boolean }
): void {
  const { LAYOUT } = window.FB.CONSTANTS;
  
  if (!pageEl.svgHost) return;
  if (!panel) { 
    pageEl.svgHost.innerHTML = ''; 
    if (pageEl.materialUtilization) pageEl.materialUtilization.style.display = 'none';
    return; 
  }
  
  const { pageRows, pageCols, pageVSpace, pageInvert, nestingOffset, pageHSpaceNumber } = layoutElements;
  
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
  state.lastLayoutWpx = layoutWpx;
  state.lastLayoutHpx = layoutHpx;
  const hostW = pageEl.svgHost.clientWidth || 1;
  const hostH = pageEl.svgHost.clientHeight || 1;
  const needsFit = layoutWpx > hostW || layoutHpx > hostH;
  const rawFitPct = Math.min(hostW / layoutWpx, hostH / layoutHpx) * 100;
  const fitPct = Math.max(20, Math.min(300, Math.floor(rawFitPct) - 1));

  pageEl.svgHost.innerHTML = '';
  const svg = createLayoutSvg(panel, { rows, cols, hSpace, vSpace, dotDiameter, showGrid, invertOdd, nestingVerticalOffset });
  
  // Calculate and display material utilization
  const utilization = calculateMaterialUtilization(panel, { rows, cols, hSpace, vSpace, invertOdd, nestingVerticalOffset });
  if (pageEl.materialUtilization && pageEl.utilizationValue) {
    pageEl.utilizationValue.textContent = `${utilization.toFixed(1)}%`;
    pageEl.materialUtilization.style.display = 'flex';
  }
  
  const wrap = document.createElement('div');
  wrap.className = 'svg-wrap';
  wrap.appendChild(svg);
  pageEl.svgHost.appendChild(wrap);
  const currentPct = window.FB.ui?.zoom?.getPct(pageEl) || 100;
  if (state.isFirstLayoutRender) {
    // Keep user's/default 100% on first load; no auto-shrink
    window.FB.ui?.zoom?.apply(pageEl);
    window.FB.ui?.zoom?.updateDisplay(pageEl);
    state.isFirstLayoutRender = false;
  } else if (needsFit && currentPct > fitPct) {
    // Only shrink if needed to fit
    window.FB.ui?.zoom?.setPct(pageEl, fitPct);
  } else {
    window.FB.ui?.zoom?.apply(pageEl);
    window.FB.ui?.zoom?.updateDisplay(pageEl);
  }
}

/**
 * Updates page overflow styling
 */
export function updatePageOverflow(pageEl: any, state: { lastLayoutWpx: number; lastLayoutHpx: number }): void {
  if (!pageEl.svgHost) return;
  const host = pageEl.svgHost as HTMLElement;
  const hostW = host.clientWidth || 1;
  const hostH = host.clientHeight || 1;
  const scale = (window.FB.ui?.zoom?.getPct(pageEl) || 100) / 100;
  const visW = state.lastLayoutWpx * scale;
  const visH = state.lastLayoutHpx * scale;
  const tol = Math.max(10, Math.round(6 * (window.devicePixelRatio || 1))); // px
  host.style.overflowX = (visW <= hostW + tol) ? 'hidden' : 'auto';
  host.style.overflowY = (visH <= hostH + tol) ? 'hidden' : 'auto';
}

/**
 * Shows an error message in the SVG host
 */
export function showErrorMessage(message: string, el: any): void {
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

/**
 * Main render function - orchestrates the entire rendering pipeline
 */
export function createMainRenderFunction(
  el: any, 
  renderLayoutFn: (panel: Panel | null, dotSize: number) => void
) {
  return function render(): void {
    try {
      const config = collectInputValues(el);
      
      const geometryResult = computeGeometry(config);
      
      const { cornerMargin, holeSpacing } = updateDynamicConstraints(config, geometryResult, el);
      
      const panelConfig: PanelConfig = createPanelConfig(config, { cornerMargin, holeSpacing });
      
      const panel = computePanel(panelConfig);
      
      renderSVGToDOM(panel, config.dotSize, el);
      
      // Update shared state for layout rendering
      renderLayoutFn(panel, config.dotSize);
      
    } catch (error) {
      console.error('Render error:', error);
      showErrorMessage('Unable to generate footbag panel. Please refresh and try again.', el);
    }
  };
}

/**
 * Applies grid visibility to the main SVG
 */
export function applyGridVisibility(el: any): void {
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
