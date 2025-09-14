// Rendering system for the footbag panel generator
// Handles SVG rendering to DOM and render pipeline coordination

import type { Panel, PanelConfig } from '../types';
import { collectInputValues, computeGeometry, updateDynamicConstraints, createPanelConfig } from './validation';
import { createLayoutSvg, calculateMaterialUtilization } from './layout';
import { utils } from './utils';

// (old hole-to-hole estimate removed; we compute seam length analytically per side)

/**
 * Computes a panel from the given configuration
 */
export function computePanel(params: PanelConfig): Panel {
  const { nSides, sideLen, seamOffset, stitchCount, curvedEdges, hexType = 'regular', hexLong = 30, hexRatio = 0.5, curveRadius, holeSpacing, cornerMargin, starRootOffset, starRootAngle, cornerStitchSpacing = false, cornerStitchDistance = 2.0 } = params;
  const { geometry, stitches: stitchHelpers } = window.FB;
  const { SAMPLING, LAYOUT } = window.FB.CONSTANTS;
  // Apply negative seam internally for curved edges
  const appliedSeam = curvedEdges ? -Math.abs(seamOffset) : seamOffset;
  
  let verts: any[];
  let edgeInclude: ((i: number) => boolean) | null = null;

  if (nSides === 6 && hexType === 'truncated') {
    const longSideLength = hexLong;
    const shortSideLength = hexRatio * longSideLength;
    verts = geometry.truncatedHexagonVertices(longSideLength, shortSideLength);
    edgeInclude = (i: number) => i % 2 === 0;
  } else if (nSides === 10) {
    // Star shape - use sideLen as the outer radius
    verts = geometry.starVertices(sideLen, starRootAngle);
    // For stars, we want to avoid stitching at the sharp points
    // Use edgeInclude to only stitch certain edges, and increase corner margin
    edgeInclude = null; // Include all edges for now
  } else {
    const circumRadius = sideLen / (2 * Math.sin(Math.PI / nSides));
    verts = geometry.regularPolygonVertices(nSides, circumRadius);
    
    // Apply shape-specific rotations for better orientation
    if (nSides === 4) {
      // Rotate squares by 45 degrees to display as proper squares instead of diamonds
      verts = utils.rotateSquareVertices(verts);
    } else if (nSides === 6) {
      // Rotate regular hexagons by 90 degrees to have flat sides horizontal
      verts = utils.rotateHexagonVertices(verts);
    }
  }

  const radius = curvedEdges ? (Number.isFinite(curveRadius) ? curveRadius : 0) : 0;
  const outlinePath = geometry.circularArcPath(verts, radius);
  // We'll compute stitched side length from actual hole spacing after placing holes
  let stitchedSideLength = 0;
  // Debug inset path rendering removed as unused
  
  // For stars, use larger corner margin to avoid stitching too close to sharp points
  const effectiveCornerMargin = nSides === 10 ? Math.max(cornerMargin, 3.0) : cornerMargin;
  
  // Get stitches grouped by edge
  const stitchesByEdge: any[][] = (stitchHelpers as any).stitchPositionsByEdge(
    verts, radius, stitchCount, appliedSeam, holeSpacing, effectiveCornerMargin,
    SAMPLING.EDGE_SAMPLES_HIGH_PRECISION, edgeInclude, starRootOffset, cornerStitchSpacing, cornerStitchDistance
  );
  // Flatten for rendering
  const stitches = ([] as any[]).concat(...stitchesByEdge);
  // Sum hole-to-hole distances for the first non-empty side's stitches (1..n)
  const firstSide = stitchesByEdge.find((arr: any[]) => arr && arr.length >= 2);
  if (firstSide) {
    for (let i = 0; i < firstSide.length - 1; i++) {
      const a = firstSide[i];
      const b = firstSide[i + 1];
      stitchedSideLength += Math.hypot(b.x - a.x, b.y - a.y);
    }
  }
  const allX: number[] = [];
  const allY: number[] = [];
  for (let vertexIndex = 0; vertexIndex < verts.length; vertexIndex++) {
    const startVertex = verts[vertexIndex]; 
    const endVertex = verts[(vertexIndex + 1) % verts.length];
    const seg = geometry.approxArcEdgeSamples(startVertex, endVertex, radius, SAMPLING.BOUNDS_SAMPLES);
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
  return { outlinePath, stitches, bounds: { viewMinX, viewMinY, width, height }, stitchedSideLength };
}

/**
 * Renders the SVG to the DOM
 */
export function renderSVGToDOM(panel: Panel, dotDiameter: number, el: any, config?: PanelConfig): void {
  if (!el.svgHost) {
    console.error('SVG host element not available');
    return;
  }
  
  el.svgHost.innerHTML = '';
  
  const showGrid = !!(el.showGrid && el.showGrid.checked);
  const svg = window.FB.svg.createSvg(panel, { dotDiameter, showGrid });
  
  svg.style.maxWidth = '100%';
  svg.style.height = 'auto';
  
  const wrap = document.createElement('div');
  wrap.className = 'svg-wrap';
  wrap.appendChild(svg);
  el.svgHost.appendChild(wrap);
  
  // Update panel info if elements exist and config is provided
  if (config && el.panelInfoContainer && el.panelSideLengthValue && el.panelStitchedLengthValue) {
    // Display the panel side length (from user input)
    el.panelSideLengthValue.textContent = `${config.sideLen.toFixed(1)} mm`;
    
  // Calculate and display the stitched side length from seam path
  const stitchedLength = panel.stitchedSideLength ?? 0;
  el.panelStitchedLengthValue.textContent = `${stitchedLength.toFixed(1)} mm`;
    
  // Panel side radius element removed from UI
    
    // Show the panel info container
    el.panelInfoContainer.style.display = 'flex';
  }
  
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
  state: { lastLayoutWpx: number; lastLayoutHpx: number; isFirstLayoutRender: boolean },
  config?: PanelConfig | null
): void {
  const { LAYOUT } = window.FB.CONSTANTS;
  
  if (!pageEl.svgHost) return;
  if (!panel) { 
    pageEl.svgHost.innerHTML = ''; 
    if (pageEl.materialInfoContainer) pageEl.materialInfoContainer.style.display = 'none';
    return; 
  }
  
  const { pageRows, pageCols, pageVSpace, pageInvert, nestingOffset, pageHSpaceNumber } = layoutElements;
  
  const rows = pageRows ? Math.max(1, Math.min(50, parseInt(pageRows.value || '3', 10))) : 3;
  const cols = pageCols ? Math.max(1, Math.min(50, parseInt(pageCols.value || '3', 10))) : 3;
  
  // Get horizontal spacing from the number input (which shows the actual value)
  const hSpace = pageHSpaceNumber ? parseFloat(pageHSpaceNumber.value || '0') : 0;
  
  const vSpace = pageVSpace ? parseFloat(pageVSpace.value || '10') : 10;
  const showGrid = !!(pageEl.showGrid && pageEl.showGrid.checked);
  const invertOdd = !!(pageInvert && pageInvert.checked);
  const nestingVerticalOffset = nestingOffset ? parseFloat(nestingOffset.value || '0') : 0;

  // Compute if we need to auto-fit to the host viewport
  const MM_TO_PX = 96 / 25.4;
  const margin = LAYOUT.MARGIN_MM;
  const cellW = Math.max(0, panel.bounds.width - 2 * margin);
  const cellH = Math.max(0, panel.bounds.height - 2 * margin);
  const layoutWmm = cols * cellW + (cols - 1) * hSpace;
  let layoutHmm = rows * cellH + (rows - 1) * vSpace;
  
  // Add nesting vertical offset to height when applicable (same logic as in layout.ts)
  if (invertOdd && nestingVerticalOffset !== 0) {
    layoutHmm += Math.abs(nestingVerticalOffset);
  }
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
  
  // Calculate and display material dimensions
  if (pageEl.dimensionsValue) {
    pageEl.dimensionsValue.textContent = `${layoutWmm.toFixed(1)} × ${layoutHmm.toFixed(1)}`;
  }
  
  // Calculate and display material utilization
  const utilization = calculateMaterialUtilization(panel, { rows, cols, hSpace, vSpace, invertOdd, nestingVerticalOffset }, config || undefined);
  if (pageEl.utilizationValue) {
    pageEl.utilizationValue.textContent = `${utilization.toFixed(1)}%`;
  }
  
  // Show the container that holds both dimensions and utilization
  if (pageEl.materialInfoContainer) {
    pageEl.materialInfoContainer.style.display = 'flex';
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
  
  // Hide panel info container on error
  if (el.panelInfoContainer) {
    el.panelInfoContainer.style.display = 'none';
  }
}

/**
 * Main render function - orchestrates the entire rendering pipeline
 */
export function createMainRenderFunction(
  el: any, 
  renderLayoutFn: (panel: Panel | null, dotSize: number, config?: PanelConfig) => void
) {
  return function render(): void {
    try {
      const config = collectInputValues(el);
      
      const geometryResult = computeGeometry(config);
      
      const { cornerMargin, holeSpacing } = updateDynamicConstraints(config, geometryResult, el);
      
      const panelConfig: PanelConfig = createPanelConfig(config, { cornerMargin, holeSpacing });
      
      const panel = computePanel(panelConfig);
      
      renderSVGToDOM(panel, config.dotSize, el, panelConfig);
      
      // Update shared state for layout rendering
      renderLayoutFn(panel, config.dotSize, panelConfig);
      
    } catch (error) {
      console.error('Render error:', error);
      showErrorMessage('Unable to generate footbag panel. Please refresh and try again.', el);
    }
  };
}

/**
 * Applies grid visibility to the main SVG
 */
// Removed unused applyGridVisibility helper
