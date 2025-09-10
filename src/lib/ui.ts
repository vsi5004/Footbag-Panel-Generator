import type { DOMElements } from '../types';

function syncPair(range: HTMLInputElement | null, number: HTMLElement | null, onChange?: () => void): void {
  if (!range || !number) return;
  
  const sync = () => { 
    if ('value' in number) {
      (number as HTMLInputElement).value = range.value; 
    } else {
      number.textContent = range.value;
    }
  };
  
  const syncBack = () => { 
    if ('value' in number) {
      range.value = (number as HTMLInputElement).value;
    } else {
      range.value = number.textContent || '';
    }
  };
  
  range.addEventListener('input', () => { sync(); onChange && onChange(); });
  
  if ('addEventListener' in number) {
    number.addEventListener('input', () => { syncBack(); onChange && onChange(); });
  }
  
  sync();
}

function updateVisibility(el: DOMElements): void {
  const isHex = parseInt(el.shape?.value || '5', 10) === 6;
  const isTrunc = isHex && el.hexType && el.hexType.value === 'truncated';
  
  if (el.hexTypeRow) el.hexTypeRow.classList.toggle('hidden', !isHex);
  if (el.hexLongRow) el.hexLongRow.classList.toggle('hidden', !isTrunc);
  if (el.hexRatioRow) el.hexRatioRow.classList.toggle('hidden', !isTrunc);
  if (el.sideRow) el.sideRow.classList.toggle('hidden', isTrunc || false);
  
  const curvedOn = !!(el.curved && el.curved.checked);
  if (el.curveFactorRow) el.curveFactorRow.classList.toggle('hidden', !curvedOn);
}

function fixUiTextArtifacts(): void {
  const zoomOutBtn = document.getElementById('zoomOut');
  if (zoomOutBtn) zoomOutBtn.textContent = '-';
  
  const hexRatioLabel = document.querySelector('label[for="hexRatio"]');
  if (hexRatioLabel) hexRatioLabel.textContent = 'Short side ratio (S = r × long)';
}

// Zoom helpers that operate on the shared `el` map
function getZoomPct(el: DOMElements): number {
  const v = el.zoom ? parseInt(el.zoom.value, 10) : 100;
  return Math.max(20, Math.min(200, isNaN(v) ? 100 : v));
}

function setZoomPct(el: DOMElements, pct: number): void {
  const v = Math.max(20, Math.min(200, Math.round(pct)));
  if (el.zoom) el.zoom.value = String(v);
  updateZoomDisplay(el);
  applyZoom(el);
}

function adjustBy(el: DOMElements, delta: number): void { 
  setZoomPct(el, getZoomPct(el) + delta); 
}

function updateZoomDisplay(el: DOMElements): void { 
  if (el.zoomLabel && el.zoom) el.zoomLabel.textContent = `${getZoomPct(el)}%`; 
}

function applyZoom(el: DOMElements): void {
  const wrap = el.svgHost && el.svgHost.querySelector('.svg-wrap');
  if (!wrap) return;
  const scale = getZoomPct(el) / 100;
  (wrap as HTMLElement).style.transform = `scale(${scale})`;
}

export const ui = {
  syncPair,
  updateVisibility,
  fixUiTextArtifacts,
  zoom: {
    getPct: getZoomPct,
    setPct: setZoomPct,
    adjustBy,
    updateDisplay: updateZoomDisplay,
    apply: applyZoom
  }
};

// For backward compatibility with global window.FB
window.FB = window.FB || {};
window.FB.ui = ui;
