(function(){
  window.FB = window.FB || {};
  const { COLORS, STROKES } = window.FB.CONSTANTS;

  function createSvg(panel, options) {
    const { outlinePath, stitches, bounds } = panel;
    const { dotDiameter } = options;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('width', `${bounds.width}mm`);
    svg.setAttribute('height', `${bounds.height}mm`);
    svg.setAttribute('viewBox', `${bounds.viewMinX.toFixed(3)} ${bounds.viewMinY.toFixed(3)} ${bounds.width.toFixed(3)} ${bounds.height.toFixed(3)}`);
    svg.setAttribute('fill', 'none');
    svg.style.background = 'white';

    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', outlinePath);
    path.setAttribute('stroke', COLORS.cut);
    path.setAttribute('stroke-width', `${STROKES.cut}mm`);
    path.setAttribute('fill', 'none');

    const marks = document.createElementNS(svg.namespaceURI, 'g');
    marks.setAttribute('fill', COLORS.seam);
    const r = Math.max(0.1, dotDiameter / 2);
    for (const p of stitches) {
      const c = document.createElementNS(svg.namespaceURI, 'circle');
      c.setAttribute('cx', p.x.toFixed(3));
      c.setAttribute('cy', p.y.toFixed(3));
      c.setAttribute('r', r.toString());
      c.setAttribute('fill', COLORS.seam);
      marks.appendChild(c);
    }

    const grid = document.createElementNS(svg.namespaceURI, 'g');
    grid.setAttribute('stroke', '#dddddd');
    grid.setAttribute('stroke-width', '0.1mm');
    grid.setAttribute('opacity', '0.12');
    for (let x = Math.floor(bounds.viewMinX / 10) * 10; x < bounds.viewMinX + bounds.width; x += 10) {
      const l = document.createElementNS(svg.namespaceURI, 'line');
      l.setAttribute('x1', x.toFixed(3));
      l.setAttribute('y1', bounds.viewMinY.toFixed(3));
      l.setAttribute('x2', x.toFixed(3));
      l.setAttribute('y2', (bounds.viewMinY + bounds.height).toFixed(3));
      grid.appendChild(l);
    }
    for (let y = Math.floor(bounds.viewMinY / 10) * 10; y < bounds.viewMinY + bounds.height; y += 10) {
      const l = document.createElementNS(svg.namespaceURI, 'line');
      l.setAttribute('x1', bounds.viewMinX.toFixed(3));
      l.setAttribute('y1', y.toFixed(3));
      l.setAttribute('x2', (bounds.viewMinX + bounds.width).toFixed(3));
      l.setAttribute('y2', y.toFixed(3));
      grid.appendChild(l);
    }

    svg.appendChild(grid);
    svg.appendChild(path);
    svg.appendChild(marks);
    return svg;
  }

  window.FB.svg = { createSvg };
})();

