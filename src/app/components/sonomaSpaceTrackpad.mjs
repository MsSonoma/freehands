// Pure cursor math for the Sonoma keyboard's hold-Space trackpad gesture.
// The DOM input's caret uses UTF-16 offsets; keep the same coordinate system.
export const SPACE_TRACKPAD_HOLD_MS = 350;
export const SPACE_TRACKPAD_TAP_SLOP_PX = 12;
export const SPACE_TRACKPAD_CHAR_STEP_PX = 12;
export const SPACE_TRACKPAD_LINE_STEP_PX = 24;

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export function trackpadVisualRows(value, wrapColumns = 0) {
  const text = String(value ?? '');
  const columns = Number.isFinite(wrapColumns) ? Math.max(0, Math.floor(wrapColumns)) : 0;
  const rows = [{ start: 0, end: 0 }];
  let column = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      rows[rows.length - 1].end = i;
      rows.push({ start: i + 1, end: i + 1 });
      column = 0;
      continue;
    }
    if (columns > 0 && column >= columns) {
      rows[rows.length - 1].end = i;
      rows.push({ start: i, end: i });
      column = 0;
    }
    rows[rows.length - 1].end = i + 1;
    column++;
  }
  return rows;
}

export function trackpadCaretFromDrag({
  value = '',
  startCaret = 0,
  deltaX = 0,
  deltaY = 0,
  wrapColumns = 0,
  charStepPx = SPACE_TRACKPAD_CHAR_STEP_PX,
  lineStepPx = SPACE_TRACKPAD_LINE_STEP_PX,
} = {}) {
  const text = String(value ?? '');
  const initial = clamp(Math.trunc(Number(startCaret) || 0), 0, text.length);
  const horizontal = Math.trunc((Number(deltaX) || 0) / Math.max(1, charStepPx));
  const vertical = Math.trunc((Number(deltaY) || 0) / Math.max(1, lineStepPx));
  // Horizontal travel works across spaces, punctuation, and line breaks.
  if (vertical === 0) return clamp(initial + horizontal, 0, text.length);

  // Vertical travel preserves the starting column across lines. Soft wraps
  // use a measured approximation supplied by the current text field.
  const rows = trackpadVisualRows(text, wrapColumns);
  let startRow = 0;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].start <= initial) startRow = i;
    else break;
  }
  const source = rows[startRow];
  const target = rows[clamp(startRow + vertical, 0, rows.length - 1)];
  return clamp(target.start + initial - source.start + horizontal, target.start, target.end);
}

export function isShortSpaceTap(startX, startY, endX, endY, tolerancePx = SPACE_TRACKPAD_TAP_SLOP_PX) {
  return [startX, startY, endX, endY].every(Number.isFinite) &&
    Math.hypot(endX - startX, endY - startY) <= tolerancePx;
}
