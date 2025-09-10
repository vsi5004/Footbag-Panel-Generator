import type { Point } from '../types';

export const utils = {
  clamp: (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value)),
  deg2rad: (degrees: number): number => (degrees * Math.PI) / 180,
  
  /**
   * Rotates vertices by a specified angle.
   * @param vertices - Array of vertex points to rotate
   * @param angleInRadians - Rotation angle in radians
   * @returns Array of rotated vertex points
   */
  rotateVertices: (vertices: Point[], angleInRadians: number): Point[] => {
    const cos = Math.cos(angleInRadians);
    const sin = Math.sin(angleInRadians);
    return vertices.map((v: Point) => ({
      x: v.x * cos - v.y * sin,
      y: v.x * sin + v.y * cos
    }));
  },
  
  /**
   * Rotates square vertices by 45 degrees to display as proper squares instead of diamonds.
   * This is needed because regular polygon generation creates squares oriented as diamonds.
   * @param vertices - Array of vertex points to rotate
   * @returns Array of rotated vertex points
   */
  rotateSquareVertices: (vertices: Point[]): Point[] => {
    return utils.rotateVertices(vertices, Math.PI / 4); // 45 degrees
  },
  
  /**
   * Rotates hexagon vertices by 90 degrees (π/2 radians) to display with flat sides horizontal.
   * This orients regular hexagons with flat top/bottom edges instead of pointed top/bottom.
   * @param vertices - Array of vertex points to rotate
   * @returns Array of rotated vertex points
   */
  rotateHexagonVertices: (vertices: Point[]): Point[] => {
    return utils.rotateVertices(vertices, Math.PI / 2); // 90 degrees
  },

  /**
   * Creates a grid element for SVG backgrounds
   * @param svg - The SVG element to create the grid for
   * @param bounds - The bounds for the grid area
   * @param gridSpacing - Spacing between grid lines
   * @returns Grid element (not yet appended to SVG)
   */
  createGrid: (svg: SVGElement, bounds: { viewMinX: number; viewMinY: number; width: number; height: number }, gridSpacing: number): SVGGElement => {
    const grid = document.createElementNS(svg.namespaceURI, 'g') as SVGGElement;
    grid.setAttribute('id', 'grid');
    grid.setAttribute('stroke', '#bfbfbf');
    grid.setAttribute('stroke-width', '0.1mm');
    grid.setAttribute('opacity', '0.22');
    
    // Vertical lines
    for (let x = Math.floor(bounds.viewMinX / gridSpacing) * gridSpacing; x <= bounds.viewMinX + bounds.width; x += gridSpacing) {
      const l = document.createElementNS(svg.namespaceURI, 'line');
      l.setAttribute('x1', x.toFixed(3));
      l.setAttribute('y1', bounds.viewMinY.toFixed(3));
      l.setAttribute('x2', x.toFixed(3));
      l.setAttribute('y2', (bounds.viewMinY + bounds.height).toFixed(3));
      grid.appendChild(l);
    }
    
    // Horizontal lines
    const gridStartY = Math.floor(bounds.viewMinY / gridSpacing) * gridSpacing;
    const gridEndY = bounds.viewMinY + bounds.height;
    for (let y = gridStartY; y <= gridEndY; y += gridSpacing) {
      const l = document.createElementNS(svg.namespaceURI, 'line');
      l.setAttribute('x1', bounds.viewMinX.toFixed(3));
      l.setAttribute('y1', y.toFixed(3));
      l.setAttribute('x2', (bounds.viewMinX + bounds.width).toFixed(3));
      l.setAttribute('y2', y.toFixed(3));
      grid.appendChild(l);
    }
    
    return grid;
  }
};

// For backward compatibility with global window.FB
window.FB = window.FB || {};
window.FB.utils = utils;
