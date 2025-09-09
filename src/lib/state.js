(function(){
  window.FB = window.FB || {};
  const { clamp } = window.FB.utils;
  const { CURVATURE } = window.FB.CONSTANTS;

  function collect(el){
    return {
      $schema: './schema/settings.schema.json',
      version: 1,
      shape: parseInt(el.shape.value, 10),
      curved: !!el.curved.checked,
      curveFactor: el.curved.checked && el.curveFactor ? clamp(parseFloat(el.curveFactor.value), 0.10, 0.40) : undefined,
      side: clamp(parseFloat(el.side.value), 10, 80),
      seam: clamp(parseFloat(el.seam.value), 2, 9),
      stitches: parseInt(el.stitches.value, 10),
      showGrid: el.showGrid ? !!el.showGrid.checked : undefined,
      cornerMargin: el.cornerMargin ? clamp(parseFloat(el.cornerMargin.value), 0, 999) : undefined,
      holeSpacing: el.holeSpacing ? clamp(parseFloat(el.holeSpacing.value), 1, 999) : undefined,
      dotSize: clamp(parseFloat(el.dotSize.value), 0.2, 1.5),
      hex: {
        type: el.hexType ? el.hexType.value : 'regular',
        long: el.hexLong ? clamp(parseFloat(el.hexLong.value), 10, 80) : undefined,
        ratio: el.hexRatio ? clamp(parseFloat(el.hexRatio.value), 0.1, 0.9) : undefined,
      }
    };
  }

  function apply(el, s){
    if (!s || typeof s !== 'object') return;
    const set = (input, value) => { if (input != null && value != null && !Number.isNaN(value)) input.value = String(value); };
    const setChecked = (input, value) => { if (input != null && typeof value === 'boolean') input.checked = value; };

    if (typeof s.shape === 'number') el.shape.value = String(s.shape);
    setChecked(el.curved, !!s.curved);

    if (s.hex && typeof s.hex === 'object') {
      if (el.hexType && s.hex.type) el.hexType.value = s.hex.type;
      set(el.hexLong, clamp(parseFloat(s.hex.long), 10, 80));
      set(el.hexRatio, clamp(parseFloat(s.hex.ratio), 0.1, 0.9));
      if (el.hexLongNumber) set(el.hexLongNumber, el.hexLong.value);
      if (el.hexRatioNumber) set(el.hexRatioNumber, el.hexRatio.value);
    }

    set(el.side, clamp(parseFloat(s.side), 10, 80));
    set(el.sideNumber, el.side && el.side.value);
    set(el.seam, clamp(parseFloat(s.seam), 2, 9));
    set(el.seamNumber, el.seam && el.seam.value);

    if (el.curved && el.curved.checked && s.curveFactor != null) {
      set(el.curveFactor, clamp(parseFloat(s.curveFactor), 0.10, 0.40));
      set(el.curveFactorNumber, el.curveFactor && el.curveFactor.value);
    }

    if (s.stitches != null) set(el.stitches, clamp(parseInt(s.stitches, 10), 1, 50));
    if (el.stitchesNumber) set(el.stitchesNumber, el.stitches && el.stitches.value);
    if (s.showGrid != null && el.showGrid) { el.showGrid.checked = !!s.showGrid; }
    if (s.cornerMargin != null && el.cornerMargin) { set(el.cornerMargin, Math.max(0, parseFloat(s.cornerMargin))); set(el.cornerMarginNumber, el.cornerMargin.value); }
    if (s.holeSpacing != null && el.holeSpacing) { set(el.holeSpacing, Math.max(1, parseFloat(s.holeSpacing))); set(el.holeSpacingNumber, el.holeSpacing.value); }
    if (s.dotSize != null) { set(el.dotSize, clamp(parseFloat(s.dotSize), 0.2, 1.5)); set(el.dotSizeNumber, el.dotSize.value); }
  }

  window.FB.state = { collect, apply };
})();
