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
  }
};

// For backward compatibility with global window.FB
window.FB = window.FB || {};
window.FB.utils = utils;
