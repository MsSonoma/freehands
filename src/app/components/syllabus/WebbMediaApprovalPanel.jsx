'use client'

import { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { mediaDurationLabel } from '@/app/lib/webbMedia.mjs'
import { requestFacilitatorPinException } from '@/app/lib/pinGate'
import WebbFacilitatorVideoReviewOverlay from './WebbFacilitatorVideoReviewOverlay'

async function token() {
  const client = getSupabaseClient()
  const { data } = await client.auth.getSession()
  return data?.session?.access_token || ''
}

export async function webbMediaRequest(body) {
  const credential = await token()
  if (!credential) throw new Error('Sign in to use facilitator media approvals.')
  const response = await fetch('/api/webb-media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + credential },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Media request failed.')
  return data
}

export async function webbMediaList(learnerId, lessonKey) {
  const credential = await token()
  if (!credential) throw new Error('Sign in to load lesson media.')
  const query = new URLSearchParams({ learnerId: String(learnerId || ''), lessonKey: String(lessonKey || '') })
  const response = await fetch('/api/webb-media?' + query, {
    headers: { Authorization: 'Bearer ' + credential }, cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Unable to load lesson media.')
  return data.rows || []
}

const card = { padding: 12, border: '1px solid #cbd5e1', borderRadius: 10, marginTop: 8, background: '#fff' }
const btn = { border: '1px solid #94a3b8', borderRadius: 7, padding: '7px 10px', cursor: 'pointer', background: '#fff', color: '#0f172a' }
const base = { display: 'grid', gap: 10, fontSize: 14, color: '#0f172a' }

export function WebbMediaChoices({ rows, candidates, onDecision, onRequest, onPreview, learner = false }) {
  const existing = new Map(rows.map((row) => [row.resource?.kind + ':' + row.resource?.id, row]))
  return <div style={{ display: 'grid', gap: 9 }}>
    {candidates.map((resource) => {
      const status = existing.get(resource.kind + ':' + resource.id)
      return <div key={resource.kind + ':' + resource.id} style={card}>
        <strong>{resource.title}</strong>
        <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
          {resource.source}{' · '}{mediaDurationLabel(resource)}{' · '}
          Estimated lesson fit {resource.fitScore}/10
        </div>
        {resource.description && <p style={{ fontSize: 13, margin: '6px 0' }}>{resource.description}</p>}
        {resource.fitReason && <div style={{ fontSize: 12 }}>Fit: {resource.fitReason}</div>}
        {resource.ageNote && <div style={{ fontSize: 12 }}>Age: {resource.ageNote}</div>}
        {!learner && resource.kind === 'video' && <button type="button" style={{ ...btn, marginTop: 8 }} onClick={() => onPreview?.(resource)}>Watch video and review</button>}
        {!learner && resource.kind === 'article' && resource.url && <a href={resource.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 6, fontSize: 13, color: '#0d9488' }}>Preview source before deciding</a>}
        {status?.status && <div style={{ fontSize: 12, fontWeight: 700, marginTop: 5 }}>{status.status === 'approved' ? 'Facilitator approved' : status.status === 'pending' ? 'Permission requested' : 'Not approved'}</div>}
        {learner ? (
          status?.status !== 'approved' && <button type="button" style={{ ...btn, marginTop: 7 }} disabled={status?.status === 'pending'} onClick={() => onRequest?.(resource)}>
            {status?.status === 'pending' ? 'Waiting for facilitator' : 'Ask facilitator'}
          </button>
        ) : <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <button type="button" style={btn} onClick={() => onDecision?.(resource, 'approved', false)}>Approve {resource.kind}</button>
          {resource.kind === 'video' && <button type="button" style={btn} onClick={() => onDecision?.(resource, 'approved', true)}>Approve for work and play</button>}
          <button type="button" style={btn} onClick={() => onDecision?.(resource, 'rejected', false)}>Reject</button>
        </div>}
      </div>
    })}
  </div>
}

export default function WebbMediaApprovalPanel({ learnerId, lessonKey, lesson }) {
  const [rows, setRows] = useState([])
  const [candidates, setCandidates] = useState({ video: [], article: [] })
  const [kind, setKind] = useState('video')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reviewVideo, setReviewVideo] = useState(null)
  const [seen, setSeen] = useState({ video: [], article: [] })

  useEffect(() => {
    if (!learnerId || !lessonKey) return undefined
    let alive = true
    const refresh = () => webbMediaList(learnerId, lessonKey)
      .then((next) => { if (alive) setRows(next) })
      .catch((cause) => { if (alive) setError(cause.message) })
    void refresh()
    const interval = setInterval(refresh, 12000)
    return () => { alive = false; clearInterval(interval) }
  }, [learnerId, lessonKey])

  async function search(nextKind = kind) {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const data = await webbMediaRequest({
        action: 'search', learnerId, lessonKey, lesson, kind: nextKind,
        query: query.trim(), seenIds: seen[nextKind],
      })
      setCandidates((old) => ({ ...old, [nextKind]: data.results }))
      setSeen((old) => ({
        ...old, [nextKind]: [...new Set([...old[nextKind], ...data.results.map((item) => item.id)])],
      }))
      if (!data.results.length) setNotice('No more suggestions were found. Try different search terms.')
    } catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }

  function openVideoReview(resource) {
    setError('')
    setReviewVideo(resource)
  }

  async function decide(resource, status, workAllowed) {
    const pin = await requestFacilitatorPinException({
      title: 'Approve lesson media',
      message: 'Confirm your decision for ' + resource.title,
    })
    if (!pin) return false
    setBusy(true); setError(''); setNotice('')
    try {
      const data = await webbMediaRequest({
        action: 'decide', learnerId, lessonKey, pin,
        decisions: [{ resource, status, workAllowed }],
      })
      setRows(data.rows)
      setNotice(status === 'approved' ? 'Approved. The learner can access this resource in the permitted time.' : 'Resource not approved.')
      return true
    } catch (cause) { setError(cause.message); return false }
    finally { setBusy(false) }
  }

  async function decideFromVideoReview(resource, status, workAllowed) {
    if (await decide(resource, status, workAllowed)) setReviewVideo(null)
  }

  const pending = rows.filter((row) => row.status === 'pending')
  return <section style={{ ...base, marginTop: 12, padding: 12, border: '1px solid #cbd5e1', borderRadius: 12 }}>
    <h3 style={{ margin: 0 }}>Mrs. Webb lesson media</h3>
    <p style={{ margin: 0 }}>Review and approve videos and articles. Search results and suitability ratings are suggestions, not content approval. Videos are for play time unless you explicitly allow them during work. Articles are for work-time reading.</p>
    {pending.length > 0 && <>
      <strong>Learner requests ({pending.length})</strong>
      <WebbMediaChoices rows={rows} candidates={pending.map((r) => r.resource)} onDecision={decide} onPreview={openVideoReview} />
    </>}
    <label>Resource type
      <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ marginLeft: 8 }}>
        <option value="video">Videos</option><option value="article">Articles</option>
      </select>
    </label>
    <label>Search for approved lesson materials
      <input style={{ width: '100%', padding: 9, boxSizing: 'border-box', border: '1px solid #94a3b8', borderRadius: 8 }}
        placeholder={lesson?.title || 'Lesson topic'} value={query} onChange={(e) => { setQuery(e.target.value); setSeen({ video: [], article: [] }) }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void search() } }} />
    </label>
    <button type="button" style={btn} disabled={busy} onClick={() => void search()}>{busy ? 'Searching or saving...' : 'Find three ' + (kind === 'video' ? 'videos' : 'articles')}</button>
    {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <WebbMediaChoices rows={rows} candidates={candidates[kind]} onDecision={decide} onPreview={openVideoReview} />
    <strong>Approved resources</strong>
    <WebbMediaChoices rows={rows} candidates={rows.filter((row) => row.status === 'approved').map((row) => row.resource)} onDecision={decide} onPreview={openVideoReview} />
    {rows.every((row) => row.status !== 'approved') && <p style={{ margin: 0 }}>No media approved yet.</p>}
    {reviewVideo && <WebbFacilitatorVideoReviewOverlay
      video={reviewVideo}
      status={rows.find((row) => row.resource?.kind === 'video' && row.resource?.id === reviewVideo.id)?.status || ''}
      busy={busy}
      error={error}
      onClose={() => setReviewVideo(null)}
      onDecision={decideFromVideoReview}
    />}
  </section>
}
