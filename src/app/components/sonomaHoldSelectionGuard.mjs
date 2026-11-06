// Prevent iOS Safari's long-press text-selection gesture from escaping an
// interactive button and highlighting unrelated lesson text. The guard is
// temporary: editable text remains selectable, and release/cancel restores
// normal document selection immediately.
export const SONOMA_CONTROL_HOLD_CLASS = 'ms-sonoma-control-held';
const CONTROL_SELECTOR = 'button, [role="button"], [data-sonoma-game-target], [data-sonoma-hold-control]';

export function isSonomaHoldControlTarget(target) {
  const element = typeof target?.closest === 'function' ? target : target?.parentElement;
  return Boolean(element?.closest?.(CONTROL_SELECTOR));
}

export function attachSonomaHoldSelectionGuard(doc) {
  if (!doc?.documentElement?.classList || !doc?.addEventListener) return () => {};
  const win = doc.defaultView;
  const heldTouchIds = new Set();
  const sync = () => {
    doc.documentElement.classList.toggle(SONOMA_CONTROL_HOLD_CLASS, heldTouchIds.size > 0);
  };

  const start = (event) => {
    if (!isSonomaHoldControlTarget(event.target)) return;
    for (const touch of event.changedTouches || []) heldTouchIds.add(touch.identifier);
    sync();
  };
  const finish = (event) => {
    for (const touch of event.changedTouches || []) heldTouchIds.delete(touch.identifier);
    sync();
  };
  const clear = () => {
    heldTouchIds.clear();
    sync();
  };
  const hide = () => { if (doc.hidden) clear(); };

  // Capture first, without cancelling pointer events, so press/hold, taps,
  // drags, accessibility activation and native text-field editing still work.
  doc.addEventListener('touchstart', start, { capture: true, passive: true });
  doc.addEventListener('touchend', finish, { capture: true, passive: true });
  doc.addEventListener('touchcancel', finish, { capture: true, passive: true });
  doc.addEventListener('visibilitychange', hide);
  win?.addEventListener?.('pagehide', clear);
  win?.addEventListener?.('blur', clear);

  return () => {
    doc.removeEventListener('touchstart', start, true);
    doc.removeEventListener('touchend', finish, true);
    doc.removeEventListener('touchcancel', finish, true);
    doc.removeEventListener('visibilitychange', hide);
    win?.removeEventListener?.('pagehide', clear);
    win?.removeEventListener?.('blur', clear);
    clear();
  };
}
