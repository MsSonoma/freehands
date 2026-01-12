'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

function useIsMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  return mounted
}

export default function PortfolioScansModal({
  open,
  onClose,
  learnerId,
  lessonKey,
  lessonTitle,
  authToken,
  portal = false,
  zIndex = 10015
}) {
  const isMounted = useIsMounted()
  const [kind, setKind] = useState('worksheet')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  const canUse = !!open && !!learnerId && !!lessonKey && !!authToken

  const title = useMemo(() => {
    if (lessonTitle) return `Add Images (Scans) — ${lessonTitle}`
    return 'Add Images (Scans)'
  }, [lessonTitle])

  async function load() {
    if (!canUse) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/portfolio-scans/load?learnerId=${encodeURIComponent(learnerId)}&lessonKey=${encodeURIComponent(lessonKey)}&kind=${encodeURIComponent(kind)}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      )
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Failed to load scans')
      setItems(Array.isArray(data?.items) ? data.items : [])
    } catch (e) {
      setItems([])
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind, learnerId, lessonKey, authToken])

  async function handleUpload(fileList) {
    const files = Array.from(fileList || []).filter(Boolean)
    if (!files.length) return
    if (!canUse) return

    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.set('learnerId', learnerId)
      fd.set('lessonKey', lessonKey)
      fd.set('kind', kind)
      for (const f of files) fd.append('files', f)

      const res = await fetch('/api/portfolio-scans/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: fd
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Upload failed')

      // Refresh signed URLs and ordering
      await load()
    } catch (e) {
      setError(e?.message || String(e))
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(path) {
    if (!path || !canUse) return
    const ok = window.confirm('Delete this scan? This cannot be undone.')
    if (!ok) return

    try {
      const res = await fetch('/api/portfolio-scans/delete', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ learnerId, path })
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Delete failed')
      await load()
    } catch (e) {
      setError(e?.message || String(e))
    }
  }

  if (!open) return null

  const modal = (
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
          width: 'min(820px, 96vw)',
          maxHeight: '92vh',
          overflow: 'auto',
          background: '#fff',
          borderRadius: 12,
          border: '1px solid #e5e7eb',
          boxShadow: '0 20px 50px rgba(0,0,0,0.25)'
        }}
      >
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>{title}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              Upload worksheet/test scans (separate from Visual Aids).
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

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, fontWeight: 800, color: '#111827' }}>Type</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 13,
                background: '#fff'
              }}
            >
              <option value="worksheet">Worksheet</option>
              <option value="test">Test</option>
              <option value="other">Other</option>
            </select>

            <label
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #c7d2fe',
                background: uploading ? '#eef2ff' : '#eff6ff',
                color: '#1e40af',
                fontWeight: 800,
                cursor: uploading ? 'not-allowed' : 'pointer',
                fontSize: 13
              }}
              title="Upload image scans (PNG/JPG/WebP/PDF)"
            >
              {uploading ? 'Uploading…' : 'Upload Files'}
              <input
                type="file"
                multiple
                accept="image/*,application/pdf"
                disabled={uploading || !canUse}
                onChange={(e) => handleUpload(e.target.files)}
                style={{ display: 'none' }}
              />
            </label>

            <button
              onClick={load}
              disabled={loading || !canUse}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                background: '#fff',
                color: '#374151',
                fontWeight: 800,
                cursor: loading || !canUse ? 'not-allowed' : 'pointer',
                fontSize: 13
              }}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: 12, fontWeight: 800, color: '#111827' }}>
              Uploaded {kind} scans ({items.length})
            </div>

            {loading ? (
              <div style={{ padding: 12, color: '#6b7280' }}>Loading…</div>
            ) : items.length === 0 ? (
              <div style={{ padding: 12, color: '#6b7280' }}>No uploads yet.</div>
            ) : (
              <div style={{ padding: 12, display: 'grid', gap: 10 }}>
                {items.map((it) => (
                  <div
                    key={it.path}
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'center',
                      padding: 10,
                      border: '1px solid #e5e7eb',
                      borderRadius: 10
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {it.name}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>{it.created_at ? new Date(it.created_at).toLocaleString() : ''}</div>
                    </div>

                    {it.url && (
                      <a
                        href={it.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          padding: '7px 10px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          background: '#fff',
                          color: '#111827',
                          fontWeight: 800,
                          fontSize: 12,
                          textDecoration: 'none'
                        }}
                      >
                        Open
                      </a>
                    )}

                    <button
                      onClick={() => handleDelete(it.path)}
                      style={{
                        padding: '7px 10px',
                        borderRadius: 8,
                        border: '1px solid #fecaca',
                        background: '#fff',
                        color: '#dc2626',
                        fontWeight: 900,
                        cursor: 'pointer',
                        fontSize: 12
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  if (!portal) return modal
  if (!isMounted) return null
  return createPortal(modal, document.body)
}
