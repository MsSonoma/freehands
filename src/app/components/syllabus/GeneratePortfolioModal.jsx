'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

function isYyyyMmDd(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function todayLocalYyyyMmDd() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDaysLocal(dateStr, days) {
  try {
    const [y, m, d] = String(dateStr || '').split('-').map(n => Number(n))
    if (!y || !m || !d) return null
    const dt = new Date(y, m - 1, d)
    if (Number.isNaN(dt.getTime())) return null
    dt.setDate(dt.getDate() + Number(days || 0))
    const yy = dt.getFullYear()
    const mm = String(dt.getMonth() + 1).padStart(2, '0')
    const dd = String(dt.getDate()).padStart(2, '0')
    return `${yy}-${mm}-${dd}`
  } catch {
    return null
  }
}

export default function GeneratePortfolioModal({
  open,
  onClose,
  learnerId,
  learnerName,
  authToken,
  zIndex = 10025,
  portal = false
}) {
  const [isMounted, setIsMounted] = useState(false)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [includeVisualAids, setIncludeVisualAids] = useState(true)
  const [includeNotes, setIncludeNotes] = useState(true)
  const [includeImages, setIncludeImages] = useState(true)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const [savedLoading, setSavedLoading] = useState(false)
  const [savedError, setSavedError] = useState(null)
  const [savedItems, setSavedItems] = useState([])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    setError(null)
    setResult(null)

    const today = todayLocalYyyyMmDd()
    const defaultStart = addDaysLocal(today, -30) || today

    setStartDate((prev) => (isYyyyMmDd(prev) ? prev : defaultStart))
    setEndDate((prev) => (isYyyyMmDd(prev) ? prev : today))
  }, [open])

  async function loadSavedPortfolios() {
    if (!learnerId || !authToken) return

    setSavedLoading(true)
    setSavedError(null)

    try {
      const res = await fetch(`/api/portfolio/list?learnerId=${encodeURIComponent(learnerId)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Failed to load saved portfolios')

      setSavedItems(Array.isArray(data?.items) ? data.items : [])
    } catch (e) {
      setSavedError(e?.message || String(e))
      setSavedItems([])
    } finally {
      setSavedLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    loadSavedPortfolios()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, learnerId, authToken])

  async function handleDeleteSaved(portfolioId) {
    if (!learnerId || !authToken || !portfolioId) return
    const ok = typeof window !== 'undefined' ? window.confirm('Delete this saved portfolio? This will break the public link.') : false
    if (!ok) return

    setSavedLoading(true)
    setSavedError(null)

    try {
      const res = await fetch('/api/portfolio/delete', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ learnerId, portfolioId })
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Failed to delete portfolio')

      await loadSavedPortfolios()
    } catch (e) {
      setSavedError(e?.message || String(e))
    } finally {
      setSavedLoading(false)
    }
  }

  const title = useMemo(() => {
    const name = learnerName ? ` — ${learnerName}` : ''
    return `Generate Portfolio${name}`
  }, [learnerName])

  const canGenerate = Boolean(
    learnerId &&
      authToken &&
      isYyyyMmDd(startDate) &&
      isYyyyMmDd(endDate) &&
      startDate <= endDate &&
      (includeVisualAids || includeNotes || includeImages) &&
      !loading
  )

  async function handleGenerate() {
    if (!canGenerate) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/portfolio/generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          learnerId,
          startDate,
          endDate,
          includeVisualAids,
          includeNotes,
          includeImages
        })
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to generate portfolio')
      }

      setResult(data)
      await loadSavedPortfolios()
    } catch (e) {
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const content = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        zIndex,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div
        style={{
          width: 'min(760px, 96vw)',
          maxHeight: '92vh',
          overflow: 'auto',
          background: '#fff',
          borderRadius: 12,
          border: '1px solid #e5e7eb',
          boxShadow: '0 20px 50px rgba(0,0,0,0.25)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>{title}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              Creates a shareable portfolio link that does not require app login.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              background: '#fff',
              color: '#374151',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>

        <div style={{ padding: 16, display: 'grid', gap: 14 }}>
          {!authToken && (
            <div style={{ padding: 12, borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontWeight: 700 }}>
              Not signed in. Please refresh and try again.
            </div>
          )}

          {error && (
            <div style={{ padding: 12, borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontWeight: 700 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: '#111827' }}>Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  padding: '10px 10px',
                  borderRadius: 8,
                  border: '1px solid #d1d5db',
                  fontSize: 13
                }}
              />
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: '#111827' }}>End date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  padding: '10px 10px',
                  borderRadius: 8,
                  border: '1px solid #d1d5db',
                  fontSize: 13
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 800, color: '#111827' }}>Include</label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff' }}>
              <input type="checkbox" checked={includeVisualAids} onChange={(e) => setIncludeVisualAids(e.target.checked)} />
              <div style={{ display: 'grid', gap: 2 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>Visual aids</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Selected lesson visuals used during teaching.</div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff' }}>
              <input type="checkbox" checked={includeNotes} onChange={(e) => setIncludeNotes(e.target.checked)} />
              <div style={{ display: 'grid', gap: 2 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>Notes</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Facilitator notes saved per lesson.</div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff' }}>
              <input type="checkbox" checked={includeImages} onChange={(e) => setIncludeImages(e.target.checked)} />
              <div style={{ display: 'grid', gap: 2 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>Images</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Worksheet/test scans or photos of work (copied into a public portfolio folder).</div>
              </div>
            </label>

            {!(includeVisualAids || includeNotes || includeImages) && (
              <div style={{ fontSize: 12, color: '#991b1b', fontWeight: 700 }}>Select at least one item to include.</div>
            )}

            {isYyyyMmDd(startDate) && isYyyyMmDd(endDate) && startDate > endDate && (
              <div style={{ fontSize: 12, color: '#991b1b', fontWeight: 700 }}>Start date must be before end date.</div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                background: '#fff',
                color: '#374151',
                fontSize: 13,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: 'none',
                background: canGenerate ? '#2563eb' : '#93c5fd',
                color: '#fff',
                fontSize: 13,
                fontWeight: 800,
                cursor: canGenerate ? 'pointer' : 'not-allowed'
              }}
            >
              {loading ? 'Generating…' : 'Generate Portfolio'}
            </button>
          </div>

          {result?.indexUrl && (
            <div style={{ padding: 12, borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#065f46' }}>Portfolio ready</div>
              <div style={{ fontSize: 12, color: '#065f46', marginTop: 6 }}>
                <a href={result.indexUrl} target="_blank" rel="noreferrer" style={{ color: '#065f46', textDecoration: 'underline', fontWeight: 800 }}>
                  Open portfolio (public link)
                </a>
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(result.indexUrl)
                    } catch {}
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #86efac',
                    background: '#fff',
                    color: '#065f46',
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: 'pointer'
                  }}
                >
                  Copy link
                </button>
                {result.manifestUrl && (
                  <a
                    href={result.manifestUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: '1px solid #86efac',
                      background: '#fff',
                      color: '#065f46',
                      fontSize: 12,
                      fontWeight: 900,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center'
                    }}
                  >
                    Download manifest.json
                  </a>
                )}
              </div>

              {(typeof result?.completedLessonCount === 'number' || typeof result?.skippedLessonCount === 'number') && (
                <div style={{ marginTop: 10, fontSize: 12, color: '#065f46' }}>
                  Completed lessons: {result.completedLessonCount ?? 0}. Skipped (not completed): {result.skippedLessonCount ?? 0}.
                </div>
              )}

              <div style={{ marginTop: 10, fontSize: 12, color: '#065f46' }}>
                Anyone with this link can view the portfolio.
              </div>
            </div>
          )}

          <div style={{ padding: 12, borderRadius: 10, background: '#fff', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#111827' }}>Saved portfolios</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  Re-open, copy links, or delete previously generated portfolios.
                </div>
              </div>
              <button
                type="button"
                onClick={loadSavedPortfolios}
                disabled={!authToken || savedLoading}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  color: '#374151',
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: !authToken || savedLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {savedLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>

            {savedError && (
              <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontWeight: 700, fontSize: 12 }}>
                {savedError}
              </div>
            )}

            {!savedLoading && !savedError && savedItems.length === 0 && (
              <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280' }}>(none yet)</div>
            )}

            <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
              {savedItems.map((item) => (
                <div key={item.id} style={{ padding: 10, borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: '#111827' }}>{item.startDate} → {item.endDate}</div>
                    {item.createdAt && <div style={{ fontSize: 12, color: '#6b7280' }}>Created {new Date(item.createdAt).toLocaleString()}</div>}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>
                    Includes: {item.include?.visualAids ? 'Visual aids' : ''}{item.include?.notes ? `${item.include?.visualAids ? ', ' : ''}Notes` : ''}{item.include?.images ? `${item.include?.visualAids || item.include?.notes ? ', ' : ''}Images` : ''}
                  </div>

                  <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <a
                      href={item.indexUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid #dbeafe',
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        fontSize: 12,
                        fontWeight: 900,
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center'
                      }}
                    >
                      Open
                    </a>

                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(item.indexUrl)
                        } catch {}
                      }}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid #d1d5db',
                        background: '#fff',
                        color: '#374151',
                        fontSize: 12,
                        fontWeight: 900,
                        cursor: 'pointer'
                      }}
                    >
                      Copy link
                    </button>

                    {item.manifestUrl && (
                      <a
                        href={item.manifestUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          background: '#fff',
                          color: '#374151',
                          fontSize: 12,
                          fontWeight: 900,
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center'
                        }}
                      >
                        Manifest
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteSaved(item.portfolioId)}
                      disabled={savedLoading}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid #fecaca',
                        background: '#fff',
                        color: '#991b1b',
                        fontSize: 12,
                        fontWeight: 900,
                        cursor: savedLoading ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  if (portal && isMounted && typeof document !== 'undefined') {
    return createPortal(content, document.body)
  }

  return content
}
