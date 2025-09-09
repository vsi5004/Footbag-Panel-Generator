(function(){
  window.FB = window.FB || {};
  const { deg2rad } = window.FB.utils;
  const { SAMPLING } = window.FB.CONSTANTS;

  function regularPolygonVertices(n, radius) {
    const verts = [];
    const startAngle = -Math.PI / 2;
    const step = (2 * Math.PI) / n;
    for (let i = 0; i < n; i++) {
      const a = startAngle + i * step;
      verts.push({ x: radius * Math.cos(a), y: radius * Math.sin(a) });
    }
    return verts;
  }
  function edgeMidpoint(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
  function outwardNormal(a, b) {
    const dx = b.x - a.x; const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dy / len, y: -dx / len };
  }
  function quadPoint(a, c, b, t) {
    const mt = 1 - t;
    const x = mt * mt * a.x + 2 * mt * t * c.x + t * t * b.x;
    const y = mt * mt * a.y + 2 * mt * t * c.y + t * t * b.y;
    return { x, y };
  }
  function quadTangent(a, c, b, t) {
    const x = 2 * (1 - t) * (c.x - a.x) + 2 * t * (b.x - c.x);
    const y = 2 * (1 - t) * (c.y - a.y) + 2 * t * (b.y - c.y);
    return { x, y };
  }
  function quadraticCurvePath(verts, curveDepth) {
    const n = verts.length; if (n < 3) return '';
    let d = '';
    for (let i = 0; i < n; i++) {
      const a = verts[i];
      const b = verts[(i + 1) % n];
      const m = edgeMidpoint(a, b);
      const nrm = outwardNormal(a, b);
      const c = { x: m.x + nrm.x * curveDepth, y: m.y + nrm.y * curveDepth };
      if (i === 0) d += `M ${a.x.toFixed(3)} ${a.y.toFixed(3)} `;
      d += `Q ${c.x.toFixed(3)} ${c.y.toFixed(3)} ${b.x.toFixed(3)} ${b.y.toFixed(3)} `;
    }
    d += 'Z';
    return d;
  }
  function approxEdgeSamples(a, b, depth, samples = SAMPLING.CURVE_SAMPLES_DEFAULT) {
    const m = edgeMidpoint(a, b);
    const nrm = outwardNormal(a, b);
    const c = { x: m.x + nrm.x * depth, y: m.y + nrm.y * depth };
    const pts = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const p = quadPoint(a, c, b, t);
      const tan = quadTangent(a, c, b, t);
      const len = Math.hypot(tan.x, tan.y) || 1;
      const nx = -tan.y / len; const ny = tan.x / len;
      pts.push({ p, n: { x: nx, y: ny } });
    }
    return pts;
  }
  function centerVertices(verts) {
    let cx = 0, cy = 0; for (const v of verts) { cx += v.x; cy += v.y; }
    cx /= verts.length; cy /= verts.length;
    return verts.map(v => ({ x: v.x - cx, y: v.y - cy }));
  }
  function truncatedHexagonVertices(longSide, shortSide) {
    const dirs = [0, 60, 120, 180, 240, 300].map(deg2rad);
    const lens = [longSide, shortSide, longSide, shortSide, longSide, shortSide];
    let x = 0, y = 0; const verts = [{ x, y }];
    for (let i = 0; i < 5; i++) { x += lens[i] * Math.cos(dirs[i]); y += lens[i] * Math.sin(dirs[i]); verts.push({ x, y }); }
    return centerVertices(verts);
  }

  window.FB.geometry = {
    regularPolygonVertices,
    edgeMidpoint,
    outwardNormal,
    quadPoint,
    quadTangent,
    quadraticCurvePath,
    approxEdgeSamples,
    centerVertices,
    truncatedHexagonVertices,
  };
})();

