// TypeScript definitions for the Footbag Panel Generator

import type { SettingsData } from './lib/state';

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
  // Length of one side along the stitch path (seam path), in mm
  stitchedSideLength?: number;
  debugPaths?: string[];
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
  curveRadius: number;
  holeSpacing: number;
  cornerMargin: number;
  starRootOffset: number;
  starRootAngle: number;
  cornerStitchSpacing: boolean;
  cornerStitchDistance: number;
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
  curveRadius: number;
  dotSize: number;
  starRootOffset: number;
  starRootAngle: number;
  cornerStitchSpacing: boolean;
  cornerStitchDistance: number;
}

export interface EdgeSample {
  p: Point;
  t: number;
  n?: Point;
}

export interface Constants {
  COLORS: Record<string, string>;
  STROKES: Record<string, number>;
  CURVATURE: Record<number, number>;
  SAMPLING: {
    EDGE_SAMPLES_DEFAULT: number;
    EDGE_SAMPLES_HIGH_PRECISION: number;
    CURVE_SAMPLES_DEFAULT: number;
    BOUNDS_SAMPLES: number;
    ARC_LENGTH_SAMPLES: number;
  };
  LAYOUT: {
    MARGIN_MM: number;
    GRID_SPACING_MM: number;
  };
  PERFORMANCE: {
    DEBOUNCE_MS: number;
  };
  VALIDATION: {
    MIN_SPACING: number;
    MIN_EDGE_LENGTH: number;
    EPSILON: number;
  };
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
  curveRadiusRow: HTMLElement | null;
  curveRadius: HTMLInputElement | null;
  curveRadiusNumber: HTMLSpanElement | null;
  stitchesNumber: HTMLSpanElement | null;
  cornerMargin: HTMLInputElement | null;
  cornerMarginNumber: HTMLSpanElement | null;
  starRootOffsetRow: HTMLElement | null;
  starRootOffset: HTMLInputElement | null;
  starRootOffsetNumber: HTMLSpanElement | null;
  starRootAngleRow: HTMLElement | null;
  starRootAngle: HTMLInputElement | null;
  starRootAngleNumber: HTMLSpanElement | null;
  holeSpacing: HTMLInputElement | null;
  holeSpacingNumber: HTMLSpanElement | null;
  cornerStitchSpacing: HTMLInputElement | null;
  cornerStitchSpacingRow: HTMLElement | null;
  cornerStitchDistance: HTMLInputElement | null;
  cornerStitchDistanceNumber: HTMLSpanElement | null;
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
  materialInfoContainer: HTMLElement | null;
  materialDimensions: HTMLElement | null;
  dimensionsValue: HTMLSpanElement | null;
  materialUtilization: HTMLElement | null;
  utilizationValue: HTMLSpanElement | null;
  resetLayoutSettings: HTMLButtonElement | null;
  resetPanelSettings: HTMLButtonElement | null;
  // Panel info elements (for single panel preview)
  panelInfoContainer: HTMLElement | null;
  panelSideLength: HTMLElement | null;
  panelSideLengthValue: HTMLSpanElement | null;
  panelStitchedLength: HTMLElement | null;
  panelStitchedLengthValue: HTMLSpanElement | null;
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
        starVertices: (outerRadius: number, rootAngle?: number) => Point[];
        quadraticCurvePath: (verts: Point[], depth: number) => string;
        circularArcPath: (verts: Point[], radius: number) => string;
        approxEdgeSamples: (a: Point, b: Point, depth: number, samples: number) => EdgeSample[];
        approxArcEdgeSamples: (a: Point, b: Point, radius: number, samples: number) => EdgeSample[];
      };
      stitches: {
        stitchPositions: (
          verts: Point[],
          radius: number,
          count: number,
          seamOffset: number,
          holeSpacing: number,
          cornerMargin: number,
          precision: number,
          edgeInclude?: ((i: number) => boolean) | null,
          starRootOffset?: number,
          cornerStitchSpacing?: boolean,
          cornerStitchDistance?: number
        ) => Point[];
        computeAllowableSpacing: (
          verts: Point[],
          radius: number,
          count: number,
          cornerMargin: number,
          precision: number,
          edgeInclude?: ((i: number) => boolean) | null,
          starRootOffset?: number
        ) => number;
      };
      svg: {
        createSvg: (panel: Panel, options: { dotDiameter: number; showGrid?: boolean }) => SVGElement;
      };
      ui: {
        syncPair: (input: HTMLInputElement | null, display: HTMLElement | null, callback?: () => void) => void;
        updateVisibility: (elements: DOMElements) => void;
        fixUiTextArtifacts: () => void;
        zoom: {
          getPct: (elements: DOMElements) => number;
          apply: (elements: DOMElements) => void;
          updateDisplay: (elements: DOMElements) => void;
          adjustBy: (elements: DOMElements, delta: number) => void;
          setPct: (elements: DOMElements, percent: number) => void;
        };
      };
      state: {
        collect: (elements: DOMElements, layoutEl?: any) => SettingsData;
        apply: (elements: DOMElements, data: Partial<SettingsData>, layoutEl?: any) => void;
      };
    };
  }
}
