import type { Point } from '../types';

export const utils = {
  clamp: (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value)),
  deg2rad: (degrees: number): number => (degrees * Math.PI) / 180,
  
  /**
   * Rotates square vertices by 45 degrees to display as proper squares instead of diamonds.
   * This is needed because regular polygon generation creates squares oriented as diamonds.
   * @param vertices - Array of vertex points to rotate
   * @returns Array of rotated vertex points
   */
  rotateSquareVertices: (vertices: Point[]): Point[] => {
    const rotationAngle = Math.PI / 4; // 45 degrees in radians
    return vertices.map((v: Point) => ({
      x: v.x * Math.cos(rotationAngle) - v.y * Math.sin(rotationAngle),
      y: v.x * Math.sin(rotationAngle) + v.y * Math.cos(rotationAngle)
    }));
  }
};

// For backward compatibility with global window.FB
window.FB = window.FB || {};
window.FB.utils = utils;
