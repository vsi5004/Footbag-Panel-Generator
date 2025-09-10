export const utils = {
  clamp: (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value)),
  deg2rad: (degrees: number): number => (degrees * Math.PI) / 180
};

// For backward compatibility with global window.FB
window.FB = window.FB || {};
window.FB.utils = utils;
