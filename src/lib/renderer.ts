import type { LayoutSvgOptions } from './layout';
import { editablePlan, showPatternFeedback } from './editable-layout';
// Rendering system for the footbag panel generator
// Handles SVG rendering to DOM and render pipeline coordination

import type {
  Panel,
  PanelConfig,
  PanelElements,
  PageElements,
  LayoutElements,
  LayoutRenderState,
} from '../types';
import {
  collectInputValues,
  computeGeometry,
  updateDynamicConstraints,
  createPanelConfig,
} from './validation';
import { calculateMaterialUtilization, measureLayoutSvg } from './layout';
import { updateLayoutPreview } from './layout-preview';
import { updateSvgGrid } from './svg-grid';
import { createPolygonGeometry, getStitchCornerMargin } from './shape-geometry';
import { geometry } from './geometry';
import { stitches as stitchHelpers } from './stitches';
import { CONSTANTS } from './constants';
import { svg as svgHelpers } from './svg';
import { fitsStock } from './stock-nesting';
import { normalizeExportScale } from './export';
import { validPlan, planProblem } from './nesting-validation';
import { ui } from './ui';

/**
 * Computes a panel from the given configuration
 */
export function computePanel(params: PanelConfig): Panel {
  const {
    nSides,
    sideLen,
    seamOffset,
    stitchCount,
    curvedEdges,
    hexType = 'regular',
    hexLong = 30,
    hexRatio = 0.5,
    curveRadius,
    holeSpacing,
    holeBunching = 0,
    cornerMargin,
    starRootOffset,
    starRootAngle,
    cornerStitchSpacing = false,
    cornerStitchDistance = 2.0,
  } = params;
  const { SAMPLING, LAYOUT } = CONSTANTS;
  // Apply negative seam internally for curved edges
  const appliedSeam = curvedEdges ? -Math.abs(seamOffset) : seamOffset;

  const { verts, edgeInclude } = createPolygonGeometry({
    nSides,
    side: sideLen,
    hexType,
    hexLong,
    hexRatio,
    starRootAngle,
  });

  const radius = curvedEdges ? (Number.isFinite(curveRadius) ? curveRadius : 0) : 0;
  const outlinePath = geometry.circularArcPath(verts, radius);
  // We'll compute stitched side length from actual hole spacing after placing holes
  let stitchedSideLength = 0;

  // For stars, use larger corner margin to avoid stitching too close to sharp points
  const effectiveCornerMargin = getStitchCornerMargin(nSides, cornerMargin);

  // Get stitches grouped by edge
  const stitchesByEdge = stitchHelpers.stitchPositionsByEdge(
    verts,
    radius,
    stitchCount,
    appliedSeam,
    holeSpacing,
    effectiveCornerMargin,
    SAMPLING.EDGE_SAMPLES_HIGH_PRECISION,
    edgeInclude,
    starRootOffset,
    cornerStitchSpacing,
    cornerStitchDistance,
    holeBunching,
  );
  // Flatten for rendering
  const stitches = stitchesByEdge.flat();
  // Sum hole-to-hole distances for the first non-empty side's stitches (1..n)
  const firstSide = stitchesByEdge.find((arr) => arr && arr.length >= 2);
  if (firstSide) {
    for (let i = 0; i < firstSide.length - 1; i++) {
      const a = firstSide[i];
      const b = firstSide[i + 1];
      stitchedSideLength += Math.hypot(b.x - a.x, b.y - a.y);
    }
  }
  // Tight bounds: use exact arc edge bbox instead of sampled points
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    const box = geometry.getArcEdgeBoundingBox
      ? geometry.getArcEdgeBoundingBox(a, b, radius)
      : null;
    if (box) {
      if (box.minX < minX) minX = box.minX;
      if (box.maxX > maxX) maxX = box.maxX;
      if (box.minY < minY) minY = box.minY;
      if (box.maxY > maxY) maxY = box.maxY;
    } else {
      // Fallback to sampled bounds if helper not available
      const seg = geometry.approxArcEdgeSamples(a, b, radius, SAMPLING.BOUNDS_SAMPLES);
      for (const s of seg) {
        if (s.p.x < minX) minX = s.p.x;
        if (s.p.x > maxX) maxX = s.p.x;
        if (s.p.y < minY) minY = s.p.y;
        if (s.p.y > maxY) maxY = s.p.y;
      }
    }
  }
  for (const p of stitches) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const margin = LAYOUT.MARGIN_MM;
  const width = maxX - minX + margin * 2;
  const height = maxY - minY + margin * 2;
  const viewMinX = minX - margin;
  const viewMinY = minY - margin;
  return {
    outlinePath,
    stitches,
    bounds: { viewMinX, viewMinY, width, height },
    stitchedSideLength,
  };
}

/**
 * Renders the SVG to the DOM
 */
const panelPreviews = new WeakMap<
  HTMLElement,
  { panel: Panel; dot: number; svg: SVGElement; showGrid: boolean }
>();
export function renderSVGToDOM(
  panel: Panel,
  dotDiameter: number,
  el: PanelElements,
  config?: PanelConfig,
): void {
  if (!el.svgHost) {
    console.error('SVG host element not available');
    return;
  }

  const showGrid = !!(el.showGrid && el.showGrid.checked);
  const previous = panelPreviews.get(el.svgHost);
  if (
    previous &&
    previous.panel === panel &&
    previous.dot === dotDiameter &&
    previous.svg.parentElement?.parentElement === el.svgHost
  ) {
    if (previous.showGrid !== showGrid) updateSvgGrid(previous.svg, panel.bounds, showGrid);
    previous.showGrid = showGrid;
  } else {
    const svg = svgHelpers.createSvg(panel, { dotDiameter, showGrid });
    svg.style.maxWidth = '100%';
    svg.style.height = 'auto';
    const wrap = document.createElement('div');
    wrap.className = 'svg-wrap';
    wrap.appendChild(svg);
    el.svgHost.replaceChildren(wrap);
    panelPreviews.set(el.svgHost, { panel, dot: dotDiameter, svg, showGrid });
  }

  // Update panel info if elements exist and config is provided
  if (config && el.panelInfoContainer && el.panelSideLengthValue && el.panelStitchedLengthValue) {
    // Display the panel side length (from user input)
    el.panelSideLengthValue.textContent = `${config.sideLen.toFixed(1)} mm`;

    // Calculate and display the stitched side length from seam path
    const stitchedLength = panel.stitchedSideLength ?? 0;
    el.panelStitchedLengthValue.textContent = `${stitchedLength.toFixed(1)} mm`;

    // Show the panel info container
    el.panelInfoContainer.style.display = 'flex';
  }

  ui?.zoom?.apply(el);
}

/**
 * Renders the layout preview
 */
export function renderLayout(
  panel: Panel | null,
  dotDiameter: number,
  pageEl: PageElements,
  layoutElements: LayoutElements,
  state: LayoutRenderState,
  config?: PanelConfig | null,
  onLayout?: (model?: { panel: Panel; opts: LayoutSvgOptions }) => void,
): void {
  if (!pageEl.svgHost) return;
  if (!panel) {
    onLayout?.();
    pageEl.svgHost.innerHTML = '';
    if (pageEl.downloadSvg) pageEl.downloadSvg.disabled = true;
    if (pageEl.materialInfoContainer) pageEl.materialInfoContainer.style.display = 'none';
    return;
  }

  const {
    pageRows,
    pageCols,
    pageVSpace,
    pageInvert,
    nestingOffset,
    pageHSpaceNumber,
    pagePadding,
  } = layoutElements;

  const rows = pageRows ? Math.max(1, Math.min(50, parseInt(pageRows.value || '3', 10))) : 3;
  const cols = pageCols ? Math.max(1, Math.min(50, parseInt(pageCols.value || '3', 10))) : 3;

  // Get horizontal spacing from the number input (which shows the actual value)
  const hSpace = pageHSpaceNumber ? parseFloat(pageHSpaceNumber.value || '0') : 0;

  const vSpace = pageVSpace ? parseFloat(pageVSpace.value || '10') : 10;
  const showGrid = !!(pageEl.showGrid && pageEl.showGrid.checked);
  const invertOdd = !!(pageInvert && pageInvert.checked);
  const nestingVerticalOffset = nestingOffset ? parseFloat(nestingOffset.value || '0') : 0;
  const padding = pagePadding ? Math.max(0, parseFloat(pagePadding.value || '10')) : 10;

  let optimized = layoutElements.nesting?.active;
  if (
    optimized &&
    !layoutElements.nesting?.constraintsEdited &&
    (!config || !validPlan(optimized, panel, config, dotDiameter, rows * cols))
  ) {
    if (layoutElements.nesting) layoutElements.nesting.active = undefined;
    optimized = undefined;
    const status = document.getElementById('nestingStatus');
    const message =
      'The saved arrangement no longer matches this design or its clearance. Manual layout restored.';
    if (status) status.textContent = message;
    const notice = document.getElementById('layoutImportNotice');
    if (notice) notice.textContent = message;
  }
  const editable = layoutElements.editable?.current;
  if (editable && config) optimized = editablePlan(editable, config, dotDiameter);
  const problem =
    (editable || layoutElements.nesting?.constraintsEdited) && optimized && config
      ? planProblem(optimized, panel, config, dotDiameter, editable?.count ?? rows * cols)
      : undefined;
  const editableSafe =
    !layoutElements.editable?.error && !problem && (!editable || (!!optimized && !!config));

  // Track physical size for scrolling without changing the user's zoom.
  const MM_TO_PX = 96 / 25.4;
  const { width: layoutWmm, height: layoutHmm } = measureLayoutSvg(panel, {
    rows,
    cols,
    hSpace,
    vSpace,
    dotDiameter,
    showGrid,
    invertOdd,
    nestingVerticalOffset,
    padding,
    optimized,
  });
  const layoutWpx = layoutWmm * MM_TO_PX;
  const layoutHpx = layoutHmm * MM_TO_PX;
  state.lastLayoutWpx = layoutWpx;
  state.lastLayoutHpx = layoutHpx;

  const countLabel = document.getElementById('layoutPanelCount');
  if (countLabel) countLabel.textContent = `${optimized?.placements.length ?? rows * cols} panels`;

  // Calculate and display material dimensions
  if (pageEl.dimensionsValue) {
    pageEl.dimensionsValue.textContent = `${layoutWmm.toFixed(1)} × ${layoutHmm.toFixed(1)}`;
  }

  // Calculate and display material utilization
  const utilization = calculateMaterialUtilization(
    panel,
    {
      rows,
      cols,
      hSpace,
      vSpace,
      invertOdd,
      nestingVerticalOffset,
      dotDiameter,
      padding,
      optimized,
      showGrid,
    },
    config || undefined,
  );
  if (pageEl.utilizationValue) {
    pageEl.utilizationValue.textContent = utilization === null ? '—' : `${utilization.toFixed(1)}%`;
    pageEl.utilizationValue.title =
      utilization === null
        ? 'Unavailable: sheet width and height must be positive and finite.'
        : '';
  }

  // Show the container that holds both dimensions and utilization
  if (pageEl.materialInfoContainer) {
    pageEl.materialInfoContainer.style.display = 'flex';
  }

  const stockFits =
    !optimized ||
    fitsStock(
      panel,
      optimized,
      dotDiameter,
      padding,
      normalizeExportScale(layoutElements.exportScale?.value),
    );
  showPatternFeedback(layoutElements, {
    problem,
    plan: optimized,
    width: layoutWmm,
    height: layoutHmm,
    scale: normalizeExportScale(layoutElements.exportScale?.value) / 100,
  });
  const validDimensions =
    editableSafe &&
    stockFits &&
    Number.isFinite(layoutWmm) &&
    Number.isFinite(layoutHmm) &&
    layoutWmm > 0 &&
    layoutHmm > 0;
  if (pageEl.downloadSvg) pageEl.downloadSvg.disabled = !validDimensions;
  if (!validDimensions) {
    onLayout?.();
    pageEl.svgHost.replaceChildren();
    state.lastLayoutWpx = 0;
    state.lastLayoutHpx = 0;
    const message = document.createElement('p');
    message.setAttribute('role', 'status');
    message.textContent =
      layoutElements.editable?.error ??
      (!editableSafe
        ? problem === 'design'
          ? 'Saved placements no longer match the panel design. Optimize again or choose Grid layout.'
          : problem === 'rotations'
            ? 'This edited layout uses rotations outside its allowed policy. Adjust the highlighted rotation settings before downloading.'
            : problem === 'outline'
              ? 'The panel outline crosses itself. Adjust the panel design before downloading this pattern.'
              : 'This edited layout does not meet its cutting gap. Adjust the highlighted center spacing, pattern or gap before downloading.'
        : !stockFits
          ? 'This arrangement exceeds the stock limits at the current export scale or padding. Reduce the export scale, search again, or choose Grid layout before downloading.'
          : 'Sheet width and height must be positive. Increase horizontal or vertical spacing, or sheet padding, to preview and download this layout.');
    pageEl.svgHost.appendChild(message);
    return;
  }
  const cutLayout = {
    panel,
    opts: {
      rows,
      cols,
      hSpace,
      vSpace,
      dotDiameter,
      showGrid,
      invertOdd,
      nestingVerticalOffset,
      padding,
      optimized,
    },
  };
  onLayout?.(cutLayout);
  const existing = pageEl.svgHost.querySelector('svg');
  const svg = updateLayoutPreview(panel, cutLayout.opts, existing);
  if (svg !== existing) {
    const wrap = document.createElement('div');
    wrap.className = 'svg-wrap';
    wrap.appendChild(svg);
    pageEl.svgHost.replaceChildren(wrap);
  }
  // Rendering or accepting a proposal must not derive zoom from the previous
  // content height: it can temporarily collapse while the preview is replaced.
  ui?.zoom?.apply(pageEl);
  ui?.zoom?.updateDisplay(pageEl);
}

/**
 * Updates page overflow styling
 */
export function updatePageOverflow(
  pageEl: PageElements,
  state: Pick<LayoutRenderState, 'lastLayoutWpx' | 'lastLayoutHpx'>,
): void {
  if (!pageEl.svgHost) return;
  const host = pageEl.svgHost as HTMLElement;
  const hostW = host.clientWidth || 1;
  const hostH = host.clientHeight || 1;
  const scale = (ui?.zoom?.getPct(pageEl) || 100) / 100;
  const visW = state.lastLayoutWpx * scale;
  const visH = state.lastLayoutHpx * scale;
  const tol = Math.max(10, Math.round(6 * (window.devicePixelRatio || 1))); // px
  host.style.overflowX = visW <= hostW + tol ? 'hidden' : 'auto';
  host.style.overflowY = visH <= hostH + tol ? 'hidden' : 'auto';
}

/**
 * Shows an error message in the SVG host
 */
export function showErrorMessage(message: string, el: PanelElements): void {
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
  el: PanelElements,
  renderLayoutFn: (panel: Panel | null, dotSize: number, config?: PanelConfig) => void,
) {
  let previousKey = '';
  let previousPanel: Panel | undefined;
  return function render(): void {
    try {
      const config = collectInputValues(el);

      const geometryResult = computeGeometry(config);

      const { cornerMargin, holeSpacing, holeBunching } = updateDynamicConstraints(
        config,
        geometryResult,
        el,
      );

      // Star constraints may raise the radius on a size/angle change. Use that
      // resolved radius immediately rather than rendering one frame of straight edges.
      const resolvedConfig =
        config.nSides === 10 && el.curveRadius
          ? { ...config, curveRadius: Number(el.curveRadius.value) }
          : config;
      const panelConfig: PanelConfig = createPanelConfig(resolvedConfig, {
        cornerMargin,
        holeSpacing,
        holeBunching,
      });

      const key = JSON.stringify(panelConfig);
      const panel =
        key === previousKey && previousPanel ? previousPanel : computePanel(panelConfig);
      previousKey = key;
      previousPanel = panel;

      renderSVGToDOM(panel, config.dotSize, el, panelConfig);

      // Update shared state for layout rendering
      renderLayoutFn(panel, config.dotSize, panelConfig);
    } catch (error) {
      console.error('Render error:', error);
      showErrorMessage('Unable to generate footbag panel. Please refresh and try again.', el);
    }
  };
}
