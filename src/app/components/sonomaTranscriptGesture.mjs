// A transcript tap dismisses the Sonoma Keyboard; a drag or scroll does not.
const TAP_MOVE_TOLERANCE_PX = 10;
const SCROLL_MOVE_TOLERANCE_PX = 1;

export function isTranscriptTapGesture(start, end, currentScrollTop) {
  if (!start || !end || start.pointerId !== end.pointerId || start.dragged) return false;
  const coordinates = [start.clientX, start.clientY, end.clientX, end.clientY, start.scrollTop, currentScrollTop];
  if (!coordinates.every(Number.isFinite)) return false;
  const movement = Math.hypot(end.clientX - start.clientX, end.clientY - start.clientY);
  const scrollMovement = Math.abs(currentScrollTop - start.scrollTop);
  return movement <= TAP_MOVE_TOLERANCE_PX && scrollMovement <= SCROLL_MOVE_TOLERANCE_PX;
}
