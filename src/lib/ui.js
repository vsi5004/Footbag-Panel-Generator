(function(){
  window.FB = window.FB || {};

  function syncPair(range, number, onChange){
    if (!range || !number) return;
    const sync = () => { number.value = range.value; };
    const syncBack = () => { range.value = number.value; };
    range.addEventListener('input', () => { sync(); onChange && onChange(); });
    number.addEventListener('input', () => { syncBack(); onChange && onChange(); });
    sync();
  }

  function updateVisibility(el){
    const isHex = parseInt(el.shape.value, 10) === 6;
    const isTrunc = isHex && el.hexType && el.hexType.value === 'truncated';
    if (el.hexTypeRow) el.hexTypeRow.classList.toggle('hidden', !isHex);
    if (el.hexLongRow) el.hexLongRow.classList.toggle('hidden', !isTrunc);
    if (el.hexRatioRow) el.hexRatioRow.classList.toggle('hidden', !isTrunc);
    if (el.sideRow) el.sideRow.classList.toggle('hidden', isTrunc);
    const curvedOn = !!(el.curved && el.curved.checked);
    if (el.curveFactorRow) el.curveFactorRow.classList.toggle('hidden', !curvedOn);
  }

  function fixUiTextArtifacts(){
    const zoomOutBtn = document.getElementById('zoomOut');
    if (zoomOutBtn) zoomOutBtn.textContent = '-';
    const hexRatioLabel = document.querySelector('label[for="hexRatio"]');
    if (hexRatioLabel) hexRatioLabel.textContent = 'Short side ratio (S = r × long)';
  }

  // Zoom helpers that operate on the shared `el` map
  function getZoomPct(el){
    const v = el.zoom ? parseInt(el.zoom.value, 10) : 100;
    return Math.max(20, Math.min(200, isNaN(v) ? 100 : v));
  }
  function setZoomPct(el, pct){
    const v = Math.max(20, Math.min(200, Math.round(pct)));
    if (el.zoom) el.zoom.value = String(v);
    updateZoomDisplay(el);
    applyZoom(el);
  }
  function adjustBy(el, delta){ setZoomPct(el, getZoomPct(el) + delta); }
  function updateZoomDisplay(el){ if (el.zoomLabel && el.zoom) el.zoomLabel.textContent = `${getZoomPct(el)}%`; }
  function applyZoom(el){
    const wrap = el.svgHost && el.svgHost.querySelector('.svg-wrap');
    if (!wrap) return;
    const scale = getZoomPct(el) / 100;
    wrap.style.transform = `scale(${scale})`;
  }

  window.FB.ui = { syncPair, updateVisibility, fixUiTextArtifacts, zoom: { getPct: getZoomPct, setPct: setZoomPct, adjustBy, updateDisplay: updateZoomDisplay, apply: applyZoom } };
})();
