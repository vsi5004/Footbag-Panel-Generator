(function(){
  window.FB = window.FB || {};
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const deg2rad = (d) => (d * Math.PI) / 180;
  window.FB.utils = { clamp, deg2rad };
})();

