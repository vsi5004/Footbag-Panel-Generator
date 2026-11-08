import type { PanelElements, LayoutElements } from '../types';

export type ControlPair = readonly [HTMLInputElement | null, HTMLInputElement | null];

export function panelControlPairs(el: PanelElements): ControlPair[] {
  return [
    [el.curveRadius, el.curveRadiusNumber],
    [el.starRootAngle, el.starRootAngleNumber],
    [el.hexLong, el.hexLongNumber],
    [el.hexRatio, el.hexRatioNumber],
    [el.side, el.sideNumber],
    [el.stitches, el.stitchesNumber],
    [el.seam, el.seamNumber],
    [el.holeSpacing, el.holeSpacingNumber],
    [el.holeBunching, el.holeBunchingNumber],
    [el.cornerStitchDistance, el.cornerStitchDistanceNumber],
    [el.cornerMargin, el.cornerMarginNumber],
    [el.starRootOffset, el.starRootOffsetNumber],
    [el.dotSize, el.dotSizeNumber],
  ];
}

export function layoutControlPairs(el: LayoutElements): ControlPair[] {
  return [
    [el.pagePadding, el.pagePaddingNumber],
    [el.pageRows, el.pageRowsNumber],
    [el.pageCols, el.pageColsNumber],
    [el.pageHSpace, el.pageHSpaceNumber],
    [el.pageVSpace, el.pageVSpaceNumber],
    [el.nestingOffset, el.nestingOffsetNumber],
  ];
}
