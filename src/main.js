// Footbag Panel Generator - MVP
// - Curved polygon panel (3-6 sides)
// - Seam allowance visualization (polyline approx)
// - Stitch marks at seam offset
// - SVG preview + download

// From FB.CONSTANTS
const { COLORS, STROKES, CURVATURE } = window.FB.CONSTANTS;

// DOM
const el = {
  shape: document.getElementById('shape'),
  side: document.getElementById('side'),
  sideNumber: document.getElementById('sideNumber'),
  sideRow: document.getElementById('sideRow'),
  seam: document.getElementById('seam'),
  seamNumber: document.getElementById('seamNumber'),
  curved: document.getElementById('curved'),
  curveFactorRow: document.getElementById('curveFactorRow'),
  curveFactor: document.getElementById('curveFactor'),
  curveFactorNumber: document.getElementById('curveFactorNumber'),
  stitches: document.getElementById('stitches'),
  stitchesNumber: document.getElementById('stitchesNumber'),
  cornerMargin: document.getElementById('cornerMargin'),
  cornerMarginNumber: document.getElementById('cornerMarginNumber'),
  holeSpacing: document.getElementById('holeSpacing'),
  holeSpacingNumber: document.getElementById('holeSpacingNumber'),
  dotSize: document.getElementById('dotSize'),
  dotSizeNumber: document.getElementById('dotSizeNumber'),
  // hexagon specific
  hexTypeRow: document.getElementById('hexTypeRow'),
  hexLongRow: document.getElementById('hexLongRow'),
  hexRatioRow: document.getElementById('hexRatioRow'),
  hexType: document.getElementById('hexType'),
  hexLong: document.getElementById('hexLong'),
  hexLongNumber: document.getElementById('hexLongNumber'),
  hexRatio: document.getElementById('hexRatio'),
  hexRatioNumber: document.getElementById('hexRatioNumber'),
  svgHost: document.getElementById('svgHost'),
  downloadSvg: document.getElementById('downloadSvg'),
  exportSettings: document.getElementById('exportSettings'),
  importSettings: document.getElementById('importSettings'),
  importFile: document.getElementById('importFile'),
  // Zoom
  zoom: document.getElementById('zoom'),
  zoomIn: document.getElementById('zoomIn'),
  zoomOut: document.getElementById('zoomOut'),
  zoomReset: document.getElementById('zoomReset'),
  zoomLabel: document.getElementById('zoomLabel'),
};

// Utils
const { clamp, deg2rad } = window.FB.utils;

// Use FB.geometry helpers
const G = window.FB.geometry;

// Removed explicit seam polyline rendering as per feedback

// stitches helpers
const ST = window.FB.stitches;

function edgeArcLength(verts, depth, samplesPerEdge = 100) {
  const n = verts.length;
  const lens = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % n];
    const samples = G.approxEdgeSamples(a, b, depth, samplesPerEdge);
    let len = 0;
    for (let j = 1; j < samples.length; j++) {
      const p0 = samples[j - 1].p;
      const p1 = samples[j].p;
      len += Math.hypot(p1.x - p0.x, p1.y - p0.y);
    }
    lens.push(len);
    total += len;
  }
  return { lens, total };
}

function stitchPositions(verts, depth, countPerSide, offset, prefSpacing, cornerMargin, samplesPerEdge = 120, edgeInclude = null) {
  // Place countPerSide marks per edge. If preferred spacing is too
  // large to fit that count between corner margins, reduce spacing
  // as needed to preserve the requested count.
  const n = verts.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    if (edgeInclude && !edgeInclude(i)) continue;
    const a = verts[i];
    const b = verts[(i + 1) % n];
    const samples = approxEdgeSamples(a, b, depth, samplesPerEdge);
    // Build cumulative length table for this edge
    const cum = [0];
    let edgeLen = 0;
    for (let j = 1; j < samples.length; j++) {
      const p0 = samples[j - 1].p;
      const p1 = samples[j].p;
      edgeLen += Math.hypot(p1.x - p0.x, p1.y - p0.y);
      cum.push(edgeLen);
    }
    // distribute positions between a user-defined corner margin (avoid corners)
    const cm = Math.max(0, Math.min(cornerMargin, Math.max(0, edgeLen / 2 - 0.1)));
    const usable = Math.max(0, edgeLen - 2 * cm);
    const allowable = usable / (Math.max(1, countPerSide) + 1);
    const spacing = Math.min(Math.max(0.1, prefSpacing), allowable);
    if (countPerSide <= 0 || spacing <= 0 || usable <= 0) continue;
    // Center the sequence of holes within the usable segment
    const start = cm + (usable - spacing * (countPerSide + 1)) / 2 + spacing;
    for (let k = 0; k < countPerSide; k++) {
      const target = start + k * spacing;
      // find t index nearest to target length
      let idx = 0;
      while (idx < cum.length && cum[idx] < target) idx++;
      const j = clamp(idx, 1, cum.length - 1);
      // interpolate between j-1 and j
      const t = (target - cum[j - 1]) / Math.max(1e-6, cum[j] - cum[j - 1]);
      const P0 = samples[j - 1];
      const P1 = samples[j];
      const px = P0.p.x + (P1.p.x - P0.p.x) * t;
      const py = P0.p.y + (P1.p.y - P0.p.y) * t;
      const nx = P0.n.x + (P1.n.x - P0.n.x) * t;
      const ny = P0.n.y + (P1.n.y - P0.n.y) * t;
      const nlen = Math.hypot(nx, ny) || 1;
      // offset along inward normal by positive offset (inside the shape)
      out.push({ x: px + (nx / nlen) * offset, y: py + (ny / nlen) * offset });
    }
  }
  return out;
}

// Move to stitches module

function computePanel(params) {
  const { nSides, sideLen, seamOffset, stitchCount, curvedEdges, hexType = 'regular', hexLong = 30, hexRatio = 0.5, curveFactor, holeSpacing, cornerMargin } = params;
  let verts;
  let curveScaleR;
  let edgeInclude = null;

  if (nSides === 6 && hexType === 'truncated') {
    const L = hexLong;
    const S = Math.max(0.1, Math.min(0.9, hexRatio)) * L;
    verts = G.truncatedHexagonVertices(L, S);
    // Use mean radius as curvature scale
    let sumr = 0;
    for (const v of verts) sumr += Math.hypot(v.x, v.y);
    curveScaleR = (sumr / verts.length) || L;
    edgeInclude = (i) => i % 2 === 0; // long edges only
  } else {
    const R = sideLen / (2 * Math.sin(Math.PI / nSides));
    verts = G.regularPolygonVertices(nSides, R);
    curveScaleR = R;
  }

  const factor = curvedEdges ? (Number.isFinite(curveFactor) ? curveFactor : (CURVATURE[nSides] || 0.3)) : 0;
  const curveDepth = curvedEdges ? curveScaleR * factor : 0;
  const outlinePath = G.quadraticCurvePath(verts, curveDepth);
  const stitches = ST.stitchPositions(verts, curveDepth, stitchCount, seamOffset, holeSpacing, cornerMargin, 160, edgeInclude);
  // Compute bounds
  const allX = [];
  const allY = [];
  // sample outline for bounds (coarse)
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i]; const b = verts[(i + 1) % verts.length];
    const seg = G.approxEdgeSamples(a, b, curveDepth, 20);
    for (const s of seg) { allX.push(s.p.x); allY.push(s.p.y); }
  }
  for (const p of stitches) { allX.push(p.x); allY.push(p.y); }
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);
  const margin = 10; // mm around
  const width = (maxX - minX) + margin * 2;
  const height = (maxY - minY) + margin * 2;
  const viewMinX = minX - margin;
  const viewMinY = minY - margin;
  return { outlinePath, stitches, bounds: { viewMinX, viewMinY, width, height } };
}

const SVG = window.FB.svg;

function render() {
  const nSides = parseInt(el.shape.value, 10);
  const side = clamp(parseFloat(el.side.value), 10, 80);
  const seam = clamp(parseFloat(el.seam.value), 2, 9);
  const stitches = parseInt(el.stitches.value, 10);
  const curvedEdges = !!el.curved.checked;
  const hexType = el.hexType ? el.hexType.value : 'regular';
  const hexLong = el.hexLong ? clamp(parseFloat(el.hexLong.value), 10, 80) : 30;
  const hexRatio = el.hexRatio ? clamp(parseFloat(el.hexRatio.value), 0.1, 0.9) : 0.5;
  const curveFactor = el.curveFactor ? clamp(parseFloat(el.curveFactor.value), 0.10, 0.40) : (CURVATURE[nSides] || 0.3);
  // Corner margin dynamic max based on side length (or long side for truncated hex)
  const cornerMax = (nSides === 6 && hexType === 'truncated') ? (hexLong / 4) : (side / 4);
  if (el.cornerMargin) {
    const cmMaxStr = String(Math.max(0, Math.round(cornerMax * 10) / 10));
    el.cornerMargin.max = cmMaxStr;
    if (el.cornerMarginNumber) el.cornerMarginNumber.max = cmMaxStr;
  }
  const cornerMargin = el.cornerMargin ? clamp(parseFloat(el.cornerMargin.value), 0, Math.max(0, cornerMax)) : 2;
  // Build geometry to compute allowable spacing per current configuration
  let verts, curveScaleR, edgeInclude = null;
  if (nSides === 6 && hexType === 'truncated') {
    const L = hexLong; const S = Math.max(0.1, Math.min(0.9, hexRatio)) * L;
    verts = G.truncatedHexagonVertices(L, S);
    let sumr = 0; for (const v of verts) sumr += Math.hypot(v.x, v.y);
    curveScaleR = (sumr / verts.length) || L;
    edgeInclude = (i) => i % 2 === 0; // long edges only
  } else {
    const R = side / (2 * Math.sin(Math.PI / nSides));
    verts = G.regularPolygonVertices(nSides, R);
    curveScaleR = R;
  }
  const depth = (!!el.curved.checked) ? curveScaleR * curveFactor : 0;
  const allowableSpacing = ST.computeAllowableSpacing(verts, depth, stitches, cornerMargin, 160, edgeInclude);
  // Update slider max and clamp current value
  if (el.holeSpacing) {
    const maxStr = String(Math.max(1, Math.round(allowableSpacing * 10) / 10));
    el.holeSpacing.max = maxStr;
    if (el.holeSpacingNumber) el.holeSpacingNumber.max = maxStr;
  }
  const holeSpacing = el.holeSpacing ? clamp(parseFloat(el.holeSpacing.value), 1, allowableSpacing) : 5;

  const panel = computePanel({ nSides, sideLen: side, seamOffset: seam, stitchCount: stitches, curvedEdges, hexType, hexLong, hexRatio, curveFactor, holeSpacing, cornerMargin });
  const dotDiameter = clamp(parseFloat(el.dotSize.value), 0.2, 1.5);

  // Clear host
  el.svgHost.innerHTML = '';
  const svg = SVG.createSvg(panel, { dotDiameter });
  // Fit preview container: scale via CSS preserving mm in export by using viewBox-based sizing in DOM
  svg.style.maxWidth = '100%';
  svg.style.height = 'auto';
  const wrap = document.createElement('div');
  wrap.className = 'svg-wrap';
  wrap.appendChild(svg);
  el.svgHost.appendChild(wrap);
  window.FB.ui.zoom.apply(el);
}

// Debounce utility
function debounce(fn, ms) {
  let h;
  return (...args) => { clearTimeout(h); h = setTimeout(() => fn(...args), ms); };
}

function bindUI() {
  const UI = window.FB.ui;
  UI.syncPair(el.side, el.sideNumber, debouncedRender);
  UI.syncPair(el.seam, el.seamNumber, debouncedRender);
  UI.syncPair(el.dotSize, el.dotSizeNumber, debouncedRender);
  if (el.cornerMargin && el.cornerMarginNumber) UI.syncPair(el.cornerMargin, el.cornerMarginNumber, debouncedRender);
  if (el.curveFactor && el.curveFactorNumber) UI.syncPair(el.curveFactor, el.curveFactorNumber, debouncedRender);
  if (el.stitches && el.stitchesNumber) UI.syncPair(el.stitches, el.stitchesNumber, debouncedRender);
  if (el.holeSpacing && el.holeSpacingNumber) UI.syncPair(el.holeSpacing, el.holeSpacingNumber, debouncedRender);
  if (el.hexLong && el.hexLongNumber) UI.syncPair(el.hexLong, el.hexLongNumber, debouncedRender);
  if (el.hexRatio && el.hexRatioNumber) UI.syncPair(el.hexRatio, el.hexRatioNumber, debouncedRender);

  const onShapeOrHexTypeChange = () => { UI.updateVisibility(el); debouncedRender(); };
  el.shape.addEventListener('change', onShapeOrHexTypeChange);
  el.curved.addEventListener('change', () => { UI.updateVisibility(el); debouncedRender(); });
  el.stitches.addEventListener('input', debouncedRender);
  if (el.cornerMargin) el.cornerMargin.addEventListener('input', debouncedRender);
  if (el.holeSpacing) el.holeSpacing.addEventListener('input', debouncedRender);
  if (el.hexType) el.hexType.addEventListener('change', onShapeOrHexTypeChange);
  if (el.side) el.side.addEventListener('input', () => { debouncedRender(); });
  if (el.hexLong) el.hexLong.addEventListener('input', () => { debouncedRender(); });
  // Zoom handlers
  const Z = window.FB.ui.zoom;
  if (el.zoom) el.zoom.addEventListener('input', () => { Z.updateDisplay(el); Z.apply(el); });
  if (el.zoomIn) el.zoomIn.addEventListener('click', () => { Z.adjustBy(el, 5); });
  if (el.zoomOut) el.zoomOut.addEventListener('click', () => { Z.adjustBy(el, -5); });
  if (el.zoomReset) el.zoomReset.addEventListener('click', () => { Z.setPct(el, 100); });

  el.downloadSvg.addEventListener('click', () => {
    const svg = el.svgHost.querySelector('svg');
    if (!svg) return;
    const clone = svg.cloneNode(true);
    // Ensure background is white on export
    clone.style.background = 'white';
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const shapeBase = {3:'tri',4:'sq',5:'penta',6:'hexa'}[parseInt(el.shape.value,10)] || 'panel';
    const useTrunc = (parseInt(el.shape.value,10) === 6 && el.hexType && el.hexType.value === 'truncated');
    const shapeLabel = useTrunc ? `${shapeBase}-trunc` : shapeBase;
    const sizeLabel = useTrunc ? `${el.hexLong.value}mmL-${el.hexRatio.value}r` : `${el.side.value}mm-side`;
    a.download = `footbag-${shapeLabel}-${sizeLabel}-${el.stitches.value}st-${el.curved.checked?'curved':'straight'}.svg`;
    a.href = url;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  // Export/Import settings
  const STATE = window.FB.state;
  if (el.exportSettings) {
    el.exportSettings.addEventListener('click', () => {
      const settings = STATE.collect(el);
      const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const shapeBase = {3:'tri',4:'sq',5:'penta',6:'hexa'}[parseInt(el.shape.value,10)] || 'panel';
      const ts = new Date().toISOString().replace(/[:.]/g,'-');
      a.download = `footbag-${shapeBase}-settings-${ts}.json`;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }
  if (el.importSettings && el.importFile) {
    el.importSettings.addEventListener('click', () => {
      el.importFile.click();
    });
    el.importFile.addEventListener('change', () => {
      const file = el.importFile.files && el.importFile.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result || '{}'));
          STATE.apply(el, data);
          UI.updateVisibility(el);
          debouncedRender();
        } catch (e) {
          alert('Invalid settings file.');
        }
        el.importFile.value = '';
      };
      reader.readAsText(file);
    });
  }
}

function updateVisibility() {
  const isHex = parseInt(el.shape.value, 10) === 6;
  const isTrunc = isHex && el.hexType && el.hexType.value === 'truncated';
  if (el.hexTypeRow) el.hexTypeRow.classList.toggle('hidden', !isHex);
  if (el.hexLongRow) el.hexLongRow.classList.toggle('hidden', !isTrunc);
  if (el.hexRatioRow) el.hexRatioRow.classList.toggle('hidden', !isTrunc);
  if (el.sideRow) el.sideRow.classList.toggle('hidden', isTrunc);
  const curvedOn = !!(el.curved && el.curved.checked);
  if (el.curveFactorRow) el.curveFactorRow.classList.toggle('hidden', !curvedOn);
}


// Zoom helpers moved to FB.ui.zoom

const debouncedRender = debounce(render, 50);



// Initialize
window.FB.ui.fixUiTextArtifacts();
bindUI();
window.FB.ui.updateVisibility(el);
render();

