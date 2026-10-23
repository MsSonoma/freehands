// Keep the latest transcript content visible inside its OWN scroll area.
// Do not call scrollIntoView here: on iPad it can scroll the entire lesson page.
export function pinTranscriptToEnd(scroller) {
  if (!scroller) return false;
  const scrollHeight = Number(scroller.scrollHeight);
  const clientHeight = Number(scroller.clientHeight);
  if (!Number.isFinite(scrollHeight) || !Number.isFinite(clientHeight) || clientHeight < 0) return false;
  const bottom = Math.max(0, scrollHeight - clientHeight);
  scroller.scrollTop = bottom;
  return true;
}

export function isTranscriptAtEnd(scroller, tolerance = 8) {
  if (!scroller) return false;
  const remaining = Number(scroller.scrollHeight) - Number(scroller.clientHeight) - Number(scroller.scrollTop);
  return Number.isFinite(remaining) && remaining <= tolerance;
}
