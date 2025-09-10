import type { Constants } from '../types';

export const CONSTANTS: Constants = {
  COLORS: {
    cut: '#000000',
    seam: '#808080',
  },
  STROKES: {
    cut: 0.25,
    seam: 0.2,
  },
  CURVATURE: {
    3: 0.20,
    4: 0.25,
    5: 0.30,
    6: 0.35,
  },
  SAMPLING: {
    EDGE_SAMPLES_DEFAULT: 120,
    EDGE_SAMPLES_HIGH_PRECISION: 160,
    CURVE_SAMPLES_DEFAULT: 40,
    BOUNDS_SAMPLES: 20,
    ARC_LENGTH_SAMPLES: 100,
  },
  LAYOUT: {
    MARGIN_MM: 10,
    GRID_SPACING_MM: 10,
  },
  PERFORMANCE: {
    DEBOUNCE_MS: 50,
  },
  VALIDATION: {
    MIN_SPACING: 0.1,
    MIN_EDGE_LENGTH: 0.1,
    EPSILON: 1e-6,
  }
};

// For backward compatibility with global window.FB
window.FB = window.FB || {};
window.FB.CONSTANTS = CONSTANTS;
