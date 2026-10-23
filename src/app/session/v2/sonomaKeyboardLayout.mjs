// Geometry helpers for the active Ms. Sonoma lesson layout.
// The app-owned keyboard takes precedence over native keyboard measurements.
export function resolveSonomaKeyboardClearance({
  customOpen = false,
  customHeight = 0,
  nativeVisible = false,
  nativeInset = 0,
} = {}) {
  const height = customOpen ? customHeight : (nativeVisible ? nativeInset : 0);
  const normalized = Number(height);
  return Number.isFinite(normalized) ? Math.max(0, Math.ceil(normalized)) : 0;
}

// Measure the actual unobscured space above the raised input bar.
// The caller measures the top of the media row AFTER the timeline padding.
export function measureSonomaLandscapeRoom({ mediaTop, footerTop, gap = 4 } = {}) {
  if (!Number.isFinite(mediaTop) || !Number.isFinite(footerTop)) return null;
  const spacing = Number.isFinite(gap) ? Math.max(0, gap) : 0;
  return Math.max(0, Math.floor(footerTop - mediaTop - spacing));
}
