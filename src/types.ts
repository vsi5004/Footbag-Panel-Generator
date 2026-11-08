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
  // Length of one side along the stitch path (seam path), in mm
  stitchedSideLength?: number;
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
  holeBunching: number;
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
  starRootAngle?: number;
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
  holeBunching: number;
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
  SAMPLING: {
    EDGE_SAMPLES_DEFAULT: number;
    EDGE_SAMPLES_HIGH_PRECISION: number;
    CURVE_SAMPLES_DEFAULT: number;
    BOUNDS_SAMPLES: number;
  };
  LAYOUT: {
    MARGIN_MM: number;
    GRID_SPACING_MM: number;
  };
  PERFORMANCE: {
    DEBOUNCE_MS: number;
  };
}

export interface PreviewElements {
  svgHost: HTMLElement | null;
  downloadSvg: HTMLButtonElement | null;
  zoom: HTMLInputElement | null;
  zoomIn: HTMLButtonElement | null;
  zoomOut: HTMLButtonElement | null;
  zoomReset: HTMLButtonElement | null;
  zoomLabel: HTMLSpanElement | null;
  showGrid: HTMLInputElement | null;
}

export interface PanelElements extends PreviewElements {
  shape: HTMLSelectElement | null;
  side: HTMLInputElement | null;
  showHoles: HTMLInputElement | null;
  stitchesRow: HTMLElement | null;
  seamRow: HTMLElement | null;
  seam: HTMLInputElement | null;
  curved: HTMLInputElement | null;
  stitches: HTMLInputElement | null;
  dotSize: HTMLInputElement | null;
  sideNumber: HTMLInputElement | null;
  sideRow: HTMLElement | null;
  seamNumber: HTMLInputElement | null;
  curveRadiusRow: HTMLElement | null;
  curveRadius: HTMLInputElement | null;
  curveRadiusNumber: HTMLInputElement | null;
  stitchesNumber: HTMLInputElement | null;
  cornerMargin: HTMLInputElement | null;
  cornerMarginNumber: HTMLInputElement | null;
  starRootOffsetRow: HTMLElement | null;
  starRootOffset: HTMLInputElement | null;
  starRootOffsetNumber: HTMLInputElement | null;
  starRootAngleRow: HTMLElement | null;
  starRootAngle: HTMLInputElement | null;
  starRootAngleNumber: HTMLInputElement | null;
  holeSpacing: HTMLInputElement | null;
  holeSpacingNumber: HTMLInputElement | null;
  holeBunching: HTMLInputElement | null;
  holeBunchingNumber: HTMLInputElement | null;
  cornerStitchSpacing: HTMLInputElement | null;
  cornerStitchSpacingRow: HTMLElement | null;
  cornerStitchDistance: HTMLInputElement | null;
  cornerStitchDistanceNumber: HTMLInputElement | null;
  dotSizeNumber: HTMLInputElement | null;
  hexTypeRow: HTMLElement | null;
  hexLongRow: HTMLElement | null;
  hexRatioRow: HTMLElement | null;
  hexType: HTMLSelectElement | null;
  hexLong: HTMLInputElement | null;
  hexLongNumber: HTMLInputElement | null;
  hexRatio: HTMLInputElement | null;
  hexRatioNumber: HTMLInputElement | null;
  exportScale: HTMLInputElement | null;
  exportSettings: HTMLButtonElement | null;
  importSettings: HTMLButtonElement | null;
  importFile: HTMLInputElement | null;
  resetPanelSettings: HTMLButtonElement | null;
  panelInfoContainer: HTMLElement | null;
  panelSideLength: HTMLElement | null;
  panelSideLengthValue: HTMLSpanElement | null;
  panelStitchedLength: HTMLElement | null;
  panelStitchedLengthValue: HTMLSpanElement | null;
}

export interface PageElements extends PreviewElements {
  materialInfoContainer: HTMLElement | null;
  materialDimensions: HTMLElement | null;
  dimensionsValue: HTMLSpanElement | null;
  materialUtilization: HTMLElement | null;
  utilizationValue: HTMLSpanElement | null;
  resetLayoutSettings: HTMLButtonElement | null;
}

export interface LayoutElements {
  pagePadding: HTMLInputElement | null;
  pagePaddingNumber: HTMLInputElement | null;
  pageRows: HTMLInputElement | null;
  pageRowsNumber: HTMLInputElement | null;
  pageCols: HTMLInputElement | null;
  pageColsNumber: HTMLInputElement | null;
  pageHSpace: HTMLInputElement | null;
  pageHSpaceNumber: HTMLInputElement | null;
  pageVSpace: HTMLInputElement | null;
  pageVSpaceNumber: HTMLInputElement | null;
  pageInvert: HTMLInputElement | null;
  nestingOffset: HTMLInputElement | null;
  nestingOffsetNumber: HTMLInputElement | null;
  nestingOffsetRow: HTMLElement | null;
}

export interface LayoutRenderState {
  lastLayoutWpx: number;
  lastLayoutHpx: number;
  isFirstLayoutRender: boolean;
}

export type LayoutSettingsElements = LayoutElements & {
  pageEl?: PageElements;
  layoutState?: LayoutRenderState;
};

export type RenderLayout = (panel: Panel | null, dotSize: number, config?: PanelConfig) => void;
