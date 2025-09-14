import type { Constants } from '../types';

export const CONSTANTS: Constants = {
  COLORS: {
    cut: '#000000',
    seam: '#808080',
  },
  STROKES: {
  cut: 0.17,
  },
  SAMPLING: {
    EDGE_SAMPLES_DEFAULT: 120,
    EDGE_SAMPLES_HIGH_PRECISION: 160,
    CURVE_SAMPLES_DEFAULT: 40,
  BOUNDS_SAMPLES: 20,
  },
  LAYOUT: {
    MARGIN_MM: 10,
    GRID_SPACING_MM: 10,
  },
  PERFORMANCE: {
    DEBOUNCE_MS: 50,
  },
};

// For backward compatibility with global window.FB
window.FB = window.FB || {};
window.FB.CONSTANTS = CONSTANTS;
