'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import VisualAidsCarousel from '@/components/VisualAidsCarousel'

export default function VisualAidsManagerModal({
  open,
  onClose,
  learnerId,
  lessonKey,
  lessonTitle = 'Visual Aids',
  authToken,
  zIndex = 10025,
  portal = false
}) {
  const [isMounted, setIsMounted] = useState(false)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  const [visualAidsImages, setVisualAidsImages] = useState([])
  const [generationCount, setGenerationCount] = useState(0)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const requestHeaders = useMemo(() => {
    const headers = { 'Content-Type': 'application/json' }
    if (authToken) headers.Authorization = `Bearer ${authToken}`
    return headers
  }, [authToken])

  const loadVisualAids = async () => {
    if (!learnerId || !lessonKey) return
    setStatus('loading')
    setError(null)
    try {
      const resp = await fetch('/api/visual-aids/load', {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({ learnerId, lessonKey })
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(json?.error || 'Failed to load visual aids')

      setVisualAidsImages(Array.isArray(json?.images) ? json.images : [])
      setGenerationCount(typeof json?.generationCount === 'number' ? json.generationCount : 0)
      setStatus('idle')
    } catch (err) {
      setError(err?.message || 'Failed to load visual aids')
      setStatus('idle')
    }
  }

  useEffect(() => {
    if (!open) return
    loadVisualAids()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, learnerId, lessonKey])

  const handleGenerate = async () => {
    if (!learnerId || !lessonKey) return
    setStatus('generating')
    setError(null)
    try {
      const resp = await fetch('/api/visual-aids/generate', {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({ learnerId, lessonKey, count: 3 })
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(json?.error || 'Failed to generate visual aids')

      if (Array.isArray(json?.images)) {
        setVisualAidsImages((prev) => [...json.images, ...prev])
      }
      setGenerationCount((prev) => prev + 1)
      setStatus('idle')
    } catch (err) {
      setError(err?.message || 'Failed to generate visual aids')
      setStatus('idle')
    }
  }

  const handleSave = async (images) => {
    if (!learnerId || !lessonKey) return
    setStatus('saving')
    setError(null)
    try {
      const resp = await fetch('/api/visual-aids/save', {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({ learnerId, lessonKey, images })
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(json?.error || 'Failed to save visual aids')
      setStatus('idle')
      onClose?.()
    } catch (err) {
      setError(err?.message || 'Failed to save visual aids')
      setStatus('idle')
    }
  }

  if (!open) return null

  const content = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={() => onClose?.()}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          width: '100%',
          maxWidth: 980,
          maxHeight: '88vh',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>Add Image</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {lessonTitle}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={status === 'generating' || status === 'saving' || status === 'loading'}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                background: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: (status === 'generating' || status === 'saving' || status === 'loading') ? 'not-allowed' : 'pointer'
              }}
            >
              {status === 'generating' ? 'Generating…' : 'Generate'}
            </button>
            <button
              type="button"
              onClick={() => onClose?.()}
              disabled={status === 'saving'}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                background: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: status === 'saving' ? 'not-allowed' : 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {error ? (
            <div style={{ marginBottom: 12, color: '#b91c1c', fontSize: 13 }}>{error}</div>
          ) : null}

          <VisualAidsCarousel
            lessonKey={lessonKey}
            lessonTitle={lessonTitle}
            images={visualAidsImages}
            setImages={setVisualAidsImages}
            onGenerate={handleGenerate}
            onSave={handleSave}
            generationCount={generationCount}
            isGenerating={status === 'generating'}
            isSaving={status === 'saving'}
            isLoading={status === 'loading'}
          />
        </div>
      </div>
    </div>
  )

  if (portal && isMounted && typeof document !== 'undefined') {
    return createPortal(content, document.body)
  }

  return content
}
