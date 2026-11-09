// Layout system for multi-panel sheets
// Handles layout SVG creation, material utilization, and rendering

import type { Panel, Point, PanelConfig } from '../types';
import { utils } from './utils';
import { CONSTANTS } from './constants';
import { createNestedSvg } from './nested-svg';
import { measurePlaced, type NestingPlan, type Placement } from './nesting-types';
import { createPolygonGeometry } from './shape-geometry';

export interface LayoutArrangement {
  rows: number;
  cols: number;
  hSpace: number;
  vSpace: number;
  invertOdd: boolean;
  nestingVerticalOffset: number;
}

export interface LayoutSvgOptions extends LayoutArrangement {
  optimized?: NestingPlan;
  dotDiameter: number;
  showGrid: boolean;
  padding?: number;
}

function measureLayout(panel: Panel, opts: LayoutArrangement, renderPad: number, padding: number) {
  const { rows, cols, hSpace, vSpace, invertOdd, nestingVerticalOffset } = opts;
  const margin = CONSTANTS.LAYOUT.MARGIN_MM;
  const cellW = Math.max(0, panel.bounds.width - 2 * margin + 2 * renderPad);
  const cellH = Math.max(0, panel.bounds.height - 2 * margin + 2 * renderPad);
  const contentWidth = cols * cellW + (cols - 1) * hSpace;
  let contentHeight = rows * cellH + (rows - 1) * vSpace;
  if (invertOdd && nestingVerticalOffset !== 0) contentHeight += Math.abs(nestingVerticalOffset);
  return { cellW, cellH, width: contentWidth + 2 * padding, height: contentHeight + 2 * padding };
}

/** Physical sheet bounds shared by SVG generation and preview sizing. */
export function measureLayoutSvg(panel: Panel, opts: LayoutSvgOptions) {
  const renderPad = Math.max((CONSTANTS.STROKES.cut || 0) / 2, Math.max(0, opts.dotDiameter / 2));
  if (opts.optimized) {
    return {
      cellW: 0,
      cellH: 0,
      ...measurePlaced(panel, opts.optimized.placements, opts.dotDiameter, opts.padding ?? 10),
      renderPad,
    };
  }
  return { ...measureLayout(panel, opts, renderPad, opts.padding ?? 10), renderPad };
}

/**
 * Creates a layout SVG with multiple copies of the panel
 */
export function createLayoutSvg(panel: Panel, opts: LayoutSvgOptions): SVGElement {
  if (opts.optimized)
    return createNestedSvg(
      panel,
      opts.optimized,
      opts.dotDiameter,
      opts.padding ?? 10,
      opts.showGrid,
    );
  const {
    rows,
    cols,
    hSpace,
    vSpace,
    dotDiameter,
    showGrid,
    invertOdd,
    nestingVerticalOffset,
    padding = 10,
  } = opts;
  const { COLORS, STROKES, LAYOUT } = CONSTANTS;

  const margin = LAYOUT.MARGIN_MM;
  const { cellW, cellH, width, height, renderPad } = measureLayoutSvg(panel, opts);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', `${width}mm`);
  svg.setAttribute('height', `${height}mm`);

  // Adjust viewBox to account for padding and negative vertical offset
  const viewBoxX = -padding;
  let viewBoxY = -padding;
  if (invertOdd && nestingVerticalOffset < 0) {
    viewBoxY += nestingVerticalOffset;
  }
  svg.setAttribute(
    'viewBox',
    `${viewBoxX.toFixed(3)} ${viewBoxY.toFixed(3)} ${width.toFixed(3)} ${height.toFixed(3)}`,
  );
  svg.setAttribute('fill', 'none');
  svg.style.background = 'white';

  // Optional sheet grid
  if (showGrid) {
    const layoutBounds = { viewMinX: viewBoxX, viewMinY: viewBoxY, width, height };
    const grid = utils.createGrid(svg, layoutBounds, LAYOUT.GRID_SPACING_MM);
    svg.appendChild(grid);
  }

  // Translation to align panel's local coords (which include viewMin offsets)
  // Translate so that the panel's content minX/minY (excluding margin) sits at (0,0)
  const dx0 = -(panel.bounds.viewMinX + margin);
  const dy0 = -(panel.bounds.viewMinY + margin);
  const r = Math.max(0.1, dotDiameter / 2);

  // Clone identical panel markup; preserve ordinary paths/circles in exports
  // for compatibility with cutting software that does not expand SVG <use>.
  const template = document.createElementNS(svg.namespaceURI, 'g');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', panel.outlinePath);
  path.setAttribute('stroke', COLORS.cut);
  path.setAttribute('stroke-width', `${STROKES.cut}mm`);
  path.setAttribute('fill', 'none');
  template.appendChild(path);

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
  template.appendChild(marks);

  for (let ri = 0; ri < rows; ri++) {
    for (let ci = 0; ci < cols; ci++) {
      // Nudge content inward by renderPad so visual extents stay within the cell
      const offX = ci * (cellW + hSpace) + dx0 + renderPad;
      const offY = ri * (cellH + vSpace) + dy0 + renderPad;
      // Cell container at cell origin
      const gCell = document.createElementNS(svg.namespaceURI, 'g');
      gCell.setAttribute('transform', `translate(${offX.toFixed(3)} ${offY.toFixed(3)})`);
      // Inner group for optional flip within the cell box
      const g = template.cloneNode(true) as SVGGElement;
      if (invertOdd && ci % 2 === 1) {
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

      gCell.appendChild(g);
      svg.appendChild(gCell);
    }
  }
  return svg;
}

/**
 * Sum of panel areas divided by the full exported sheet area.
 * Overlapping panels are counted separately, so the ratio may exceed 100%.
 */
export function calculateMaterialUtilization(
  panel: Panel,
  opts: LayoutSvgOptions,
  config?: PanelConfig,
): number | null {
  const { width, height } = measureLayoutSvg(panel, opts);
  const totalSheetArea = width * height;
  if (width <= 0 || height <= 0 || !Number.isFinite(totalSheetArea)) return null;
  const totalPanelArea =
    calculateActualPanelArea(panel, config) *
    (opts.optimized?.placements.length ?? opts.rows * opts.cols);
  const percentage = (totalPanelArea / totalSheetArea) * 100;
  return Number.isFinite(percentage) ? percentage : null;
}

/**
 * Calculates the actual area of a panel using proper geometric calculations
 */
function calculateActualPanelArea(panel: Panel, config?: PanelConfig): number {
  // We should always have config data when called from the rendering pipeline
  if (config) {
    const preciseArea = calculatePrecisePolygonArea(config);
    if (preciseArea > 0) {
      return preciseArea;
    }
  }

  // This should never happen in normal operation since config should always be provided
  console.error(
    'No PanelConfig provided for area calculation - this indicates a bug in the rendering pipeline',
  );
  console.error('Panel bounds:', panel.bounds);
  throw new Error('Unable to calculate panel area: no configuration data available');
}

/**
 * Calculates precise polygon area using geometric formulas based on shape configuration
 */
function calculatePrecisePolygonArea(config: PanelConfig): number {
  const {
    nSides,
    sideLen,
    hexType = 'regular',
    curvedEdges,
    curveRadius,
    hexLong = 30,
    hexRatio = 0.5,
  } = config;

  if (nSides < 3) return 0;
  // Use the exact vertices used for the outline so arc feasibility agrees with
  // rendering, including rotated squares and alternating star tips/roots.
  const { verts: vertices } = createPolygonGeometry({
    nSides,
    side: sideLen,
    hexType,
    hexLong,
    hexRatio,
    starRootAngle: config.starRootAngle || 128,
  });
  let baseArea =
    nSides === 10 || (nSides === 6 && hexType === 'truncated')
      ? calculatePolygonArea(vertices)
      : (nSides * Math.pow(sideLen, 2)) / (4 * Math.tan(Math.PI / nSides));
  if (curvedEdges && Number.isFinite(curveRadius) && curveRadius > 0) {
    baseArea += sumCircularSegmentsArea(vertices, curveRadius);
  }

  return baseArea;
}

/**
 * Calculates the additional area contributed by curved segments
 * Each curved edge adds area compared to the straight edge it replaces
 */
function sumCircularSegmentsArea(vertices: Point[], radius: number): number {
  if (vertices.length < 2 || !isFinite(radius) || radius <= 0) return 0;
  let total = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const chord = Math.hypot(b.x - a.x, b.y - a.y);
    if (chord <= 0) continue;
    // The SVG falls back to a straight segment when the requested arc is infeasible.
    if (radius < chord / 2) continue;
    const R = radius;
    const theta = 2 * Math.asin(Math.min(1, Math.max(-1, chord / (2 * R))));
    const segmentArea = 0.5 * R * R * (theta - Math.sin(theta));
    total += segmentArea;
  }
  return total;
}

/**
 * Calculates the area of a polygon using the shoelace formula
 */
function calculatePolygonArea(vertices: Point[]): number {
  if (vertices.length < 3) return 0;

  let area = 0;
  const n = vertices.length;

  // Shoelace formula
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }

  return Math.abs(area) / 2;
}

// Exact transforms used by the existing manual grid, for clearance checks.
export function manualPlacements(panel: Panel, opts: LayoutSvgOptions): Placement[] {
  const { cellW, cellH, renderPad } = measureLayoutSvg(panel, { ...opts, optimized: undefined });
  const dx = -(panel.bounds.viewMinX + CONSTANTS.LAYOUT.MARGIN_MM) + renderPad;
  const dy = -(panel.bounds.viewMinY + CONSTANTS.LAYOUT.MARGIN_MM) + renderPad;
  const result: Placement[] = [];
  for (let row = 0; row < opts.rows; row++)
    for (let col = 0; col < opts.cols; col++) {
      const flip = opts.invertOdd && col % 2 === 1;
      result.push({
        x: col * (cellW + opts.hSpace) + dx,
        y:
          row * (cellH + opts.vSpace) +
          dy +
          (flip ? 2 * panel.bounds.viewMinY + panel.bounds.height + opts.nestingVerticalOffset : 0),
        angle: 0,
        ...(flip ? { flipY: true } : {}),
      });
    }
  return result;
}
