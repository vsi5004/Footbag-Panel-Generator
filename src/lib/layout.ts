// Layout system for multi-panel sheets
// Handles layout SVG creation, material utilization, and rendering

import type { Panel, Point, PanelConfig } from '../types';
import { utils } from './utils';

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
  opts: { rows: number; cols: number; hSpace: number; vSpace: number; invertOdd: boolean; nestingVerticalOffset: number },
  config?: PanelConfig
): number {
  const { rows, cols, hSpace, vSpace, invertOdd, nestingVerticalOffset } = opts;
  const { LAYOUT } = window.FB.CONSTANTS;

  // Calculate actual panel area - this should be the area of just the panel shape itself
  // We need to calculate the actual area of the footbag panel geometry, not the bounding box
  const actualPanelArea = calculateActualPanelArea(panel, config);
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
  console.error('No PanelConfig provided for area calculation - this indicates a bug in the rendering pipeline');
  console.error('Panel bounds:', panel.bounds);
  throw new Error('Unable to calculate panel area: no configuration data available');
}

/**
 * Calculates precise polygon area using geometric formulas based on shape configuration
 */
function calculatePrecisePolygonArea(config: PanelConfig): number {
  const { nSides, sideLen, hexType = 'regular' } = config;
  
  if (nSides === 6 && hexType === 'truncated') {
    // Truncated hexagon - use vertex-based calculation since the geometric formula is complex
    return calculateAreaFromVertices(config);
    
  } else if (nSides >= 3) {
    // Regular polygon area: A = (1/2) * perimeter * apothem
    // For regular polygon: A = (n * s²) / (4 * tan(π/n))
    // where n = number of sides, s = side length
    
    const area = (nSides * Math.pow(sideLen, 2)) / (4 * Math.tan(Math.PI / nSides));
    return area;
  }
  
  return 0;
}

/**
 * Calculate area from vertices using the window.FB.geometry system
 */
function calculateAreaFromVertices(config: PanelConfig): number {
  const { nSides, sideLen, hexType = 'regular', hexLong = 30, hexRatio = 0.5 } = config;
  const { geometry } = window.FB;
  
  try {
    let vertices: Point[];
    
    if (nSides === 6 && hexType === 'truncated') {
      const longSideLength = hexLong;
      const shortSideLength = hexRatio * longSideLength;
      vertices = geometry.truncatedHexagonVertices(longSideLength, shortSideLength);
    } else {
      const circumRadius = sideLen / (2 * Math.sin(Math.PI / nSides));
      vertices = geometry.regularPolygonVertices(nSides, circumRadius);
      
      // Apply shape-specific rotations for better orientation (same as in renderer/validation)
      if (nSides === 4) {
        // Rotate squares by 45 degrees to display as proper squares instead of diamonds
        vertices = utils.rotateSquareVertices(vertices);
      } else if (nSides === 6) {
        // Rotate regular hexagons by 90 degrees to have flat sides horizontal
        vertices = utils.rotateHexagonVertices(vertices);
      }
    }
    
    return calculatePolygonArea(vertices);
  } catch (error) {
    console.warn('Failed to calculate area from vertices:', error);
    return 0;
  }
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
