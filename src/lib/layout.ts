// Layout system for multi-panel sheets
// Handles layout SVG creation, material utilization, and rendering

import type { Panel } from '../types';

/**
 * Polygon area approximation factor for material utilization calculations.
 * 
 * This represents the ratio of actual polygon area to its bounding rectangle area.
 * Based on empirical analysis of common footbag panel shapes:
 * - Regular pentagons: ~69% of bounding rectangle
 * - Regular hexagons: ~72% of bounding rectangle  
 * - Truncated hexagons: ~68% of bounding rectangle
 * - Squares: 100% (but rotated 45° reduces to ~71%)
 * - Triangles: ~65% of bounding rectangle
 * 
 * The value 0.70 (70%) provides a reasonable approximation across all supported
 * polygon types without requiring complex geometric area calculations.
 */
const POLYGON_AREA_APPROXIMATION_FACTOR = 0.70;

/**
 * Creates a layout SVG with multiple copies of the panel
 */
export function createLayoutSvg(
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

/**
 * Calculates material utilization percentage for a layout
 */
export function calculateMaterialUtilization(
  panel: Panel,
  opts: { rows: number; cols: number; hSpace: number; vSpace: number; invertOdd: boolean; nestingVerticalOffset: number }
): number {
  const { rows, cols, hSpace, vSpace, invertOdd, nestingVerticalOffset } = opts;
  const { LAYOUT } = window.FB.CONSTANTS;

  // Calculate actual panel area - this should be the area of just the panel shape itself
  // We need to calculate the actual area of the footbag panel geometry, not the bounding box
  const actualPanelArea = calculateActualPanelArea(panel);
  const totalPanelArea = actualPanelArea * rows * cols;

  // Calculate total SVG canvas area using the same logic as the SVG creation
  const margin = LAYOUT.MARGIN_MM;
  const cellW = Math.max(0, panel.bounds.width - 2 * margin);
  const cellH = Math.max(0, panel.bounds.height - 2 * margin);
  const canvasWidth = cols * cellW + (cols - 1) * hSpace;
  let canvasHeight = rows * cellH + (rows - 1) * vSpace;
  
  // Adjust canvas height for nesting vertical offset
  if (invertOdd && nestingVerticalOffset !== 0) {
    canvasHeight += Math.abs(nestingVerticalOffset);
  }
  
  const totalCanvasArea = canvasWidth * canvasHeight;

  // Calculate utilization percentage
  if (totalCanvasArea === 0) return 0;
  return (totalPanelArea / totalCanvasArea) * 100;
}

/**
 * Calculates the actual area of a panel (approximation)
 */
function calculateActualPanelArea(panel: Panel): number {
  // For a more accurate calculation, we'd need to parse the SVG path and calculate its area
  // For now, we'll use a reasonable approximation based on the panel bounds
  // Most footbag panels (pentagons, hexagons) fill roughly 65-75% of their bounding rectangle
  
  const margin = window.FB.CONSTANTS.LAYOUT.MARGIN_MM;
  const effectiveWidth = Math.max(0, panel.bounds.width - 2 * margin);
  const effectiveHeight = Math.max(0, panel.bounds.height - 2 * margin);
  
  // Use empirically-derived approximation factor for polygon shapes
  // This accounts for the fact that the panels are not rectangular
  return effectiveWidth * effectiveHeight * POLYGON_AREA_APPROXIMATION_FACTOR;
}
