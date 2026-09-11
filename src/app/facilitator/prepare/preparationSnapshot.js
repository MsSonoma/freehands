'use client'

import { normalizePreparationSnapshot } from '@/app/lib/facilitatorPreparation.mjs'

export const PREPARATION_SNAPSHOT_KEY = 'ms_sonoma_facilitator_preparation_v1'

export function readPreparationSnapshot() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PREPARATION_SNAPSHOT_KEY)
    if (!raw) return null
    return normalizePreparationSnapshot(JSON.parse(raw))
  } catch {
    return null
  }
}

export function clearPreparationSnapshot() {
  if (typeof window === 'undefined') return
  try { window.localStorage.removeItem(PREPARATION_SNAPSHOT_KEY) } catch {}
}