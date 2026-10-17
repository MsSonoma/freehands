// One-time Day Off moves retain the source weekly-pattern slot's forecast
// satisfaction, even though the actual occurrence is now placed on another day.
// This is separate from (and does not alter) the repeating weekly pattern.
function slotKey(date, order) {
  return `${String(date || '').slice(0, 10)}:${Number(order) || 0}`
}

export function instructionalOccupiedSlotKeys(item) {
  if (!item || item.item_type === 'slate_assignment') return []
  const keys = new Set([slotKey(item.planned_date, item.sort_order)])
  const moves = item.metadata?.day_off_moves
  if (Array.isArray(moves)) {
    for (const move of moves) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(move?.source_date || ''))) {
        keys.add(slotKey(move.source_date, move.source_sort_order))
      }
    }
  }
  return [...keys]
}

export function isDayOffMovedToDate(item, value) {
  const date = String(value || item?.planned_date || item?.scheduled_date || '').slice(0, 10)
  if (!date) return false
  if (item?.day_off_move_source_date && String(item?.day_off_move_destination_date || '').slice(0, 10) === date) return true
  const moves = item?.metadata?.day_off_moves
  const latest = Array.isArray(moves) ? moves.at(-1) : null
  return Boolean(latest?.source_date && String(latest?.destination_date || '').slice(0, 10) === date)
}
