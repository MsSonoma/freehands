// Visible insertion-point feedback for Sonoma's hold-Space trackpad.
// This is an overlay; it never changes the learner's text or focuses an input.

const numberValue = (value, fallback = 0) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function caretContrastColor(backgroundColor) {
  const match = String(backgroundColor || '').match(/rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)/i);
  if (!match) return '#b42318';
  const [r, g, b] = match.slice(1, 4).map(Number);
  const brightness = (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
  return brightness < 125 ? '#fde68a' : '#b42318';
}

export function visibleCaretIndicator(point, fieldRect, {
  viewportWidth = Infinity,
  viewportHeight = Infinity,
  keyboardTop = Infinity,
} = {}) {
  if (!point || !fieldRect || ![point.x, point.y, point.height, fieldRect.left, fieldRect.top, fieldRect.right, fieldRect.bottom].every(Number.isFinite)) return null;
  const leftEdge = Math.max(0, fieldRect.left + 3);
  const rightEdge = Math.min(viewportWidth - 3, fieldRect.right - 3);
  const topEdge = Math.max(0, fieldRect.top + 2);
  const bottomEdge = Math.min(viewportHeight - 2, keyboardTop - 4, fieldRect.bottom - 2);
  if (leftEdge > rightEdge || topEdge >= bottomEdge) return null;
  const height = Math.min(Math.max(12, point.height), bottomEdge - topEdge);
  const x = Math.max(leftEdge, Math.min(rightEdge, point.x));
  const y = Math.max(topEdge, Math.min(bottomEdge - height, point.y));
  return { left: x, top: y, height };
}

export function measureSonomaTextCaret(field, caretPosition) {
  if (!field?.isConnected || !['INPUT', 'TEXTAREA'].includes(field.tagName) ||
      field.type === 'password' || !field.ownerDocument?.body) return null;
  const rect = field.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const doc = field.ownerDocument;
  const style = (doc.defaultView || window).getComputedStyle(field);
  const fontSize = numberValue(style.fontSize, 16);
  const lineHeight = numberValue(style.lineHeight, Math.max(20, fontSize * 1.35));
  const pos = Math.max(0, Math.min(String(field.value ?? '').length, Math.trunc(Number(caretPosition) || 0)));
  const mirror = doc.createElement('div');
  Object.assign(mirror.style, {
    position: 'fixed',
    left: '-99999px',
    top: '0px',
    visibility: 'hidden',
    pointerEvents: 'none',
    boxSizing: 'border-box',
    width: `${field.clientWidth}px`,
    margin: '0',
    border: '0',
    padding: style.padding,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    fontVariant: style.fontVariant,
    fontKerning: style.fontKerning,
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight === 'normal' ? `${lineHeight}px` : style.lineHeight,
    textAlign: style.textAlign,
    textIndent: style.textIndent,
    textTransform: style.textTransform,
    direction: style.direction,
    tabSize: style.tabSize,
    whiteSpace: field.tagName === 'INPUT' || field.wrap === 'off' ? 'pre' : 'pre-wrap',
    overflowWrap: field.tagName === 'INPUT' || field.wrap === 'off' ? 'normal' : 'break-word',
    wordBreak: style.wordBreak,
  });
  const marker = doc.createElement('span');
  marker.textContent = '\u200b';
  mirror.appendChild(doc.createTextNode(String(field.value ?? '').slice(0, pos)));
  mirror.appendChild(marker);
  doc.body.appendChild(mirror);
  let markerRect;
  let mirrorRect;
  try {
    markerRect = marker.getBoundingClientRect();
    mirrorRect = mirror.getBoundingClientRect();
  } finally {
    mirror.remove();
  }
  const x = rect.left + numberValue(style.borderLeftWidth) + markerRect.left - mirrorRect.left - field.scrollLeft;
  const y = field.tagName === 'INPUT'
    ? rect.top + (rect.height - lineHeight) / 2
    : rect.top + numberValue(style.borderTopWidth) + markerRect.top - mirrorRect.top - field.scrollTop;
  return { x, y, height: lineHeight };
}
