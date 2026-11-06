'use client'

import { useEffect, useRef, useState } from 'react'
import { requestFacilitatorPinException } from '@/app/lib/pinGate'
import { approvedWebbMedia, mediaDurationLabel, videoEmbedUrl } from '@/app/lib/webbMedia.mjs'
import { webbMediaList, webbMediaRequest } from '@/app/components/syllabus/WebbMediaApprovalPanel'

export function WebbVideoSearch({ learnerId, lessonKey, lesson, onClose, onApproved, approvedRows = [] }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [seenIds, setSeenIds] = useState([])
  const [rows, setRows] = useState(approvedRows)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => { setRows(approvedRows) }, [approvedRows])

  async function search() {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const data = await webbMediaRequest({
        action: 'search', learnerId, lessonKey, lesson, kind: 'video',
        query: query.trim(), seenIds,
      })
      setResults(data.results)
      setSeenIds((prior) => [...new Set([...prior, ...data.results.map((row) => row.id)])])
      if (!data.results.length) setNotice('No more videos found. Try other words.')
    } catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }

  async function request(resource) {
    setBusy(true); setError(''); setNotice('')
    try {
      const data = await webbMediaRequest({ action: 'request', learnerId, lessonKey, resource })
      setRows((current) => {
        const existing = current.filter((row) => row.resource?.id !== resource.id || row.resource?.kind !== resource.kind)
        return [...existing, { resource, status: data.status }]
      })
      setNotice(data.status === 'approved' ? 'This video is already approved.' : 'Permission request sent to your facilitator.')
    } catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }

  async function approveNow(resource) {
    const pin = await requestFacilitatorPinException({
      title: 'Facilitator video approval',
      message: 'Approve ' + resource.title + ' for play time? The facilitator can separately allow work-time viewing in the Syllabus.',
    })
    if (!pin) return
    setBusy(true); setError(''); setNotice('')
    try {
      const data = await webbMediaRequest({
        action: 'decide', learnerId, lessonKey, pin,
        decisions: [{ resource, status: 'approved', workAllowed: false }],
      })
      setRows(data.rows)
      onApproved?.(data.rows)
      setNotice('Facilitator approved this video. It is now available during play time.')
    } catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }

  const known = new Map(rows.map((row) => [row.resource?.id, row]))
  return <div style={{ display: 'grid', gap: 10, padding: 14, overflowY: 'auto', maxHeight: '78vh', background: '#f8fafc', color: '#0f172a' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <strong>Find lesson videos</strong>
      <button type="button" onClick={onClose}>Close</button>
    </div>
    <p style={{ margin: 0, fontSize: 13 }}>Choose a video and ask your facilitator for permission. These results are suggestions, not pre-approved videos.</p>
    <form onSubmit={(e) => { e.preventDefault(); void search() }} style={{ display: 'flex', gap: 8 }}>
      <input aria-label="Video search terms" placeholder={lesson?.title || 'Search videos'} value={query}
        onChange={(e) => { setQuery(e.target.value); setSeenIds([]) }}
        style={{ flex: 1, minWidth: 0, padding: 9, border: '1px solid #94a3b8', borderRadius: 8 }} />
      <button type="submit" disabled={busy}>{busy ? 'Searching...' : 'Search three'}</button>
    </form>
    {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {results.map((resource) => {
      const entry = known.get(resource.id)
      return <div key={resource.id} style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: 12, background: '#fff' }}>
        <strong>{resource.title}</strong>
        <small style={{ display: 'block', color: '#475569' }}>
          {resource.source} · {mediaDurationLabel(resource)} · Estimated lesson fit {resource.fitScore}/10
        </small>
        <p style={{ fontSize: 13 }}>{resource.description}</p>
        <small>Fit: {resource.fitReason}. Age: {resource.ageNote}</small>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {entry?.status === 'approved' ? <strong>Approved for play time</strong> : <>
            <button type="button" disabled={busy || entry?.status === 'pending'} onClick={() => void request(resource)}>
              {entry?.status === 'pending' ? 'Permission requested' : 'Ask facilitator'}
            </button>
            <button type="button" disabled={busy} onClick={() => void approveNow(resource)}>Facilitator PIN</button>
          </>}
        </div>
      </div>
    })}
  </div>
}

export default function WebbPlayMedia({ learnerId, lessonKey, lesson, rows, onApproved, onClose }) {
  const [active, setActive] = useState(null)
  const [playing, setPlaying] = useState(false)
  const iframeRef = useRef(null)
  const command = (func, args = []) => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*')
  const toggle = () => { command(playing ? 'pauseVideo' : 'playVideo'); setPlaying((v) => !v) }
  const restart = () => { command('seekTo', [0, true]); command('playVideo'); setPlaying(true) }
  useEffect(() => { setPlaying(false) }, [active?.id])
  const [searchOpen, setSearchOpen] = useState(false)
  const approved = approvedWebbMedia(rows, 'video')
  useEffect(() => {
    if (active && !approved.some((row) => row.id === active.id)) setActive(null)
  }, [active, approved])
  return <div style={{
    position: 'fixed', inset: 0, zIndex: 1750, padding: 16, background: '#0f172a',
    display: 'flex', flexDirection: 'column', gap: 12, color: '#fff', overflow: 'auto',
  }}>
    <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
      <strong>Lesson Media</strong><button type="button" onClick={onClose}>Back to play time</button>
    </div>
    {active && <div style={{ width: '100%', maxWidth: 960, alignSelf: 'center' }}>
      <strong>{active.title}</strong>
      <div style={{ position: 'relative', aspectRatio: '16 / 9', background: '#000', marginTop: 8 }}>
        <iframe key={active.id} ref={iframeRef} title={active.title}
          src={videoEmbedUrl(active.id) + '&origin=' + encodeURIComponent(window.location.origin)}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen style={{ width: '100%', height: '100%', border: 0 }} />
        <button type="button" aria-label={playing ? 'Pause video' : 'Play video'} onClick={toggle}
          style={{ position: 'absolute', inset: 0, border: 0, background: 'transparent', cursor: 'pointer' }} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" onClick={toggle}>{playing ? 'Pause' : 'Play'}</button>
        <button type="button" onClick={restart}>Restart</button>
      </div>
    </div>}
    <button type="button" onClick={() => setSearchOpen((open) => !open)}>
      {searchOpen ? 'Close video search' : 'Search more videos'}
    </button>
    {searchOpen && <WebbVideoSearch learnerId={learnerId} lessonKey={lessonKey} lesson={lesson}
      approvedRows={rows} onApproved={onApproved} onClose={() => setSearchOpen(false)} />}
    <strong>Approved videos</strong>
    {approved.length === 0 && <p>No videos approved for this lesson yet. Use Search more videos to ask your facilitator.</p>}
    {approved.map((resource) => <button key={resource.id} type="button"
      onClick={() => { setActive(resource); setSearchOpen(false) }}
      style={{ textAlign: 'left', padding: 12, background: '#334155', borderRadius: 9, color: '#fff', border: '1px solid #64748b' }}>
      {resource.title} · {mediaDurationLabel(resource)}
    </button>)}
  </div>
}
