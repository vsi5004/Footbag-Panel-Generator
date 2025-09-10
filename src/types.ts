// TypeScript definitions for the Footbag Panel Generator

export interface Point {
  x: number;
  y: number;
}

export interface Panel {
  outlinePath: string;
  stitches: Point[];
  bounds: {
    viewMinX: number;
    viewMinY: number;
    width: number;
    height: number;
  };
}

export interface PanelConfig {
  nSides: number;
  sideLen: number;
  seamOffset: number;
  stitchCount: number;
  curvedEdges: boolean;
  hexType?: 'regular' | 'truncated';
  hexLong?: number;
  hexRatio?: number;
  curveFactor: number;
  holeSpacing: number;
  cornerMargin: number;
}

export interface GeometryConfig {
  nSides: number;
  side: number;
  hexType: string;
  hexLong: number;
  hexRatio: number;
}

export interface GeometryResult {
  verts: Point[];
  curveScaleR: number;
  edgeInclude: ((i: number) => boolean) | null;
}

export interface UIConfig {
  nSides: number;
  side: number;
  seam: number;
  stitches: number;
  curvedEdges: boolean;
  hexType: string;
  hexLong: number;
  hexRatio: number;
  curveFactor: number;
  dotSize: number;
}

export interface EdgeSample {
  p: Point;
  t: number;
}

export interface Constants {
  COLORS: Record<string, string>;
  STROKES: Record<string, number>;
  CURVATURE: Record<number, number>;
  SAMPLING: {
    ARC_LENGTH_SAMPLES: number;
    EDGE_SAMPLES_HIGH_PRECISION: number;
    BOUNDS_SAMPLES: number;
    CURVE_SAMPLES_DEFAULT: number;
  };
  LAYOUT: {
    MARGIN_MM: number;
  };
  PERFORMANCE: {
    DEBOUNCE_MS: number;
  };
  VALIDATION: Record<string, any>;
}

export interface DOMElements {
  shape: HTMLSelectElement | null;
  side: HTMLInputElement | null;
  seam: HTMLInputElement | null;
  curved: HTMLInputElement | null;
  stitches: HTMLInputElement | null;
  dotSize: HTMLInputElement | null;
  svgHost: HTMLElement | null;
  downloadSvg: HTMLButtonElement | null;
  sideNumber: HTMLSpanElement | null;
  sideRow: HTMLElement | null;
  seamNumber: HTMLSpanElement | null;
  curveFactorRow: HTMLElement | null;
  curveFactor: HTMLInputElement | null;
  curveFactorNumber: HTMLSpanElement | null;
  stitchesNumber: HTMLSpanElement | null;
  cornerMargin: HTMLInputElement | null;
  cornerMarginNumber: HTMLSpanElement | null;
  holeSpacing: HTMLInputElement | null;
  holeSpacingNumber: HTMLSpanElement | null;
  dotSizeNumber: HTMLSpanElement | null;
  hexTypeRow: HTMLElement | null;
  hexLongRow: HTMLElement | null;
  hexRatioRow: HTMLElement | null;
  hexType: HTMLSelectElement | null;
  hexLong: HTMLInputElement | null;
  hexLongNumber: HTMLSpanElement | null;
  hexRatio: HTMLInputElement | null;
  hexRatioNumber: HTMLSpanElement | null;
  exportSettings: HTMLButtonElement | null;
  importSettings: HTMLButtonElement | null;
  importFile: HTMLInputElement | null;
  zoom: HTMLInputElement | null;
  zoomIn: HTMLButtonElement | null;
  zoomOut: HTMLButtonElement | null;
  zoomReset: HTMLButtonElement | null;
  zoomLabel: HTMLSpanElement | null;
  showGrid: HTMLInputElement | null;
}

declare global {
  interface Window {
    FB: {
      CONSTANTS: Constants;
      utils: {
        clamp: (value: number, min: number, max: number) => number;
        deg2rad: (degrees: number) => number;
      };
      geometry: {
        regularPolygonVertices: (nSides: number, radius: number) => Point[];
        truncatedHexagonVertices: (longSide: number, shortSide: number) => Point[];
        quadraticCurvePath: (verts: Point[], depth: number) => string;
        approxEdgeSamples: (a: Point, b: Point, depth: number, samples: number) => EdgeSample[];
      };
      stitches: {
        stitchPositions: (
          verts: Point[],
          depth: number,
          count: number,
          seamOffset: number,
          holeSpacing: number,
          cornerMargin: number,
          precision: number,
          edgeInclude?: ((i: number) => boolean) | null
        ) => Point[];
        computeAllowableSpacing: (
          verts: Point[],
          depth: number,
          count: number,
          cornerMargin: number,
          precision: number,
          edgeInclude?: ((i: number) => boolean) | null
        ) => number;
      };
      svg: {
        createSvg: (panel: Panel, options: { dotDiameter: number }) => SVGElement;
      };
      ui: {
        syncPair: (input: HTMLInputElement | null, display: HTMLElement | null, callback: () => void) => void;
        updateVisibility: (elements: DOMElements) => void;
        fixUiTextArtifacts: () => void;
        zoom: {
          apply: (elements: DOMElements) => void;
          updateDisplay: (elements: DOMElements) => void;
          adjustBy: (elements: DOMElements, delta: number) => void;
          setPct: (elements: DOMElements, percent: number) => void;
        };
      };
      state: {
        collect: (elements: DOMElements) => Record<string, any>;
        apply: (elements: DOMElements, data: Record<string, any>) => void;
      };
    };
  }
}
