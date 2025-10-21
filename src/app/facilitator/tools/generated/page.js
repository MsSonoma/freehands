'use client'
import { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { featuresForTier } from '@/app/lib/entitlements'
import LessonEditor from '@/components/LessonEditor'


export default function GeneratedLessonsPage(){
  const [tier, setTier] = useState('free')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [busyItems, setBusyItems] = useState({}) // { [file]: 'approving' | 'deleting' | 'editing' }
  const [error, setError] = useState('')
  const [changeRequests, setChangeRequests] = useState({}) // { [file]: string }
  const [showChangeModal, setShowChangeModal] = useState(null) // { file, userId } when modal open
  const [editingLesson, setEditingLesson] = useState(null) // { file, userId, lesson } when editing

  async function refresh(){
    setLoading(true)
    try {
      const res = await fetch('/api/facilitator/lessons/list', { cache:'no-store' })
      const js = await res.json().catch(()=>[])
      setItems(Array.isArray(js) ? js : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const { data } = await supabase.from('profiles').select('plan_tier').eq('id', session.user.id).maybeSingle()
          if (!cancelled && data?.plan_tier) setTier((data.plan_tier || 'free').toLowerCase())
        }
      } catch {}
      if (!cancelled) await refresh()
    })()
    return () => { cancelled = true }
  }, [])

  const ent = featuresForTier(tier)
  const card = { border:'1px solid #e5e7eb', borderRadius:12, padding:12, background:'#fff' }
  const btn = { display:'inline-flex', alignItems:'center', justifyContent:'center', padding:'8px 10px', border:'1px solid #111', background:'#111', color:'#fff', borderRadius:8, fontWeight:600 }
  const btnDanger = { ...btn, background:'#b91c1c', borderColor:'#b91c1c' }
  const btnApprove = { ...btn, background:'#065f46', borderColor:'#065f46' }
  const btnSecondary = { ...btn, background:'#374151', borderColor:'#374151' }

  async function handleDelete(file, userId){
    if (!confirm('Delete this lesson?')) return
    setBusyItems(prev => ({ ...prev, [file]: 'deleting' }))
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/facilitator/lessons/delete', {
        method:'POST', headers:{ 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) },
        body: JSON.stringify({ file, userId })
      })
      if (!res.ok) {
        const js = await res.json().catch(()=>null)
        setError(js?.error || 'Delete failed')
      }
      await refresh()
    } finally {
      setBusyItems(prev => {
        const next = { ...prev }
        delete next[file]
        return next
      })
    }
  }

  async function handleApprove(file, userId){
    console.log('[APPROVE] Starting approval for:', file, 'userId:', userId)
    setBusyItems(prev => ({ ...prev, [file]: 'approving' }))
    setError('')
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      console.log('[APPROVE] Token:', token ? 'present' : 'missing')
      const res = await fetch('/api/facilitator/lessons/approve', {
        method:'POST', headers:{ 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) },
        body: JSON.stringify({ file, userId })
      })
      console.log('[APPROVE] Response status:', res.status, res.ok)
      if (!res.ok) {
        const js = await res.json().catch(()=>null)
        console.error('[APPROVE] Error response:', js)
        setError(js?.error || 'Approve failed')
        return
      }
      const responseData = await res.json().catch(() => ({}))
      console.log('[APPROVE] Success response:', responseData)
      // Success - refresh the list to show updated approval status
      await refresh()
      console.log('[APPROVE] Refresh complete')
    } catch (err) {
      console.error('[APPROVE] Exception:', err)
      setError(err?.message || 'Failed to approve lesson')
    } finally {
      setBusyItems(prev => {
        const next = { ...prev }
        delete next[file]
        return next
      })
    }
  }

  async function handleEditLesson(file, userId) {
    setBusyItems(prev => ({ ...prev, [file]: 'editing' }))
    setError('')
    try {
      const params = new URLSearchParams({ file, userId })
      const res = await fetch(`/api/facilitator/lessons/get?${params}`, { cache: 'no-store' })
      if (!res.ok) {
        const snippet = await res.text().catch(()=> '')
        setError(`Failed to load lesson JSON (${res.status}). ${snippet.slice(0, 120)}`)
        return
      }
      const lesson = await res.json()
      setEditingLesson({ file, userId, lesson })
    } finally {
      setBusyItems(prev => {
        const next = { ...prev }
        delete next[file]
        return next
      })
    }
  }

  async function handleSaveLesson(updatedLesson) {
    if (!editingLesson) return
    setBusy(true)
    setError('')
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      console.log('[SAVE_LESSON] Editing lesson context:', {
        file: editingLesson.file,
        userId: editingLesson.userId
      })
      console.log('[SAVE_LESSON] Updated lesson data:', JSON.stringify(updatedLesson, null, 2).substring(0, 500))
      console.log('[SAVE_LESSON] Has token:', !!token)
      
      const payload = { 
        file: editingLesson.file, 
        userId: editingLesson.userId,
        lesson: updatedLesson 
      }
      
      console.log('[SAVE_LESSON] Sending payload to /api/facilitator/lessons/update')
      
      const res = await fetch('/api/facilitator/lessons/update', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json', 
          ...(token ? { Authorization: `Bearer ${token}` } : {}) 
        },
        body: JSON.stringify(payload)
      })

      const js = await res.json().catch(() => null)
      console.log('[SAVE_LESSON] Response:', { status: res.status, ok: res.ok, body: js })
      
      if (!res.ok) {
        const errorMsg = js?.error || 'Failed to save lesson'
        const details = js?.details ? ` (${js.details})` : ''
        const path = js?.path ? ` [${js.path}]` : ''
        setError(errorMsg + details + path)
        console.error('[SAVE_LESSON] Error saving:', errorMsg + details + path)
        return
      }

      // Success - close editor and refresh list
      console.log('[SAVE_LESSON] Save successful, closing editor and refreshing')
      setEditingLesson(null)
      await refresh()
    } catch (err) {
      console.error('[SAVE_LESSON] Exception:', err)
      setError(err.message || 'Unknown error occurred')
    } finally {
      setBusy(false)
    }
  }

  function handleCancelEdit() {
    setEditingLesson(null)
    setError('')
  }

  async function handleRequestChanges() {
    if (!showChangeModal) return
    const { file, userId } = showChangeModal
    const changeRequest = changeRequests[file] || ''
    if (!changeRequest.trim()) {
      setError('Please describe the changes you want')
      return
    }
    setBusy(true)
    setError('')
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/facilitator/lessons/request-changes', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) },
        body: JSON.stringify({ file, changeRequest, userId })
      })
      const js = await res.json().catch(()=>null)
      if (!res.ok) {
        setError(js?.error || 'Request changes failed')
        return
      }
      setShowChangeModal(null)
      setChangeRequests(prev => {
        const next = { ...prev }
        delete next[file]
        return next
      })
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  function openChangeModal(file, userId) {
    setShowChangeModal({ file, userId })
    setError('')
  }

  function closeChangeModal() {
    setShowChangeModal(null)
    setError('')
  }

  return (
    <main style={{ padding:24, width:'100%', margin:0 }}>
      <h1 style={{ marginTop:0 }}>Generated Lessons</h1>
      
      {/* Show editor if editing a lesson */}
      {editingLesson && (
        <div style={{ marginBottom: 24 }}>
          <LessonEditor
            initialLesson={editingLesson.lesson}
            onSave={handleSaveLesson}
            onCancel={handleCancelEdit}
            busy={busy}
          />
        </div>
      )}

      {!editingLesson && !ent.facilitatorTools ? (
        <p>Premium required. <a href="/facilitator/plan">View plans</a>.</p>
      ) : !editingLesson && loading ? (
        <p>Loading…</p>
      ) : !editingLesson && items.length === 0 ? (
        <p>No generated lessons yet. Use Lesson Maker to create one.</p>
      ) : !editingLesson ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(520px, 1fr))', gap:12 }}>
          {items.map(it => {
            const itemBusy = busyItems[it.file]
            const isApproving = itemBusy === 'approving'
            const isDeleting = itemBusy === 'deleting'
            const isEditing = itemBusy === 'editing'
            const isItemBusy = !!itemBusy
            
            return (
            <div key={it.file} style={card}>
              <h3 style={{ margin:'0 0 4px' }}>{it.title || it.file}</h3>
              <p style={{ margin:'0 0 8px', color:'#555' }}>Grade: {it.grade || '—'} · {it.difficulty || '—'} · Subject: {it.subject || '—'} {it.approved ? '· Approved' : ''}{it.needsUpdate ? ' · Needs Update' : ''}</p>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <button style={btn} disabled={isItemBusy} onClick={()=>handleEditLesson(it.file, it.userId)}>
                  {isEditing ? 'Loading…' : 'Edit Lesson'}
                </button>
                <button style={btnSecondary} disabled={isItemBusy} onClick={()=>openChangeModal(it.file, it.userId)}>
                  Request AI Changes
                </button>
                <button 
                  style={{...btnApprove, ...(it.approved && !it.needsUpdate ? {opacity:0.5} : {})}} 
                  disabled={isApproving || (it.approved && !it.needsUpdate)} 
                  onClick={()=>handleApprove(it.file, it.userId)}
                >
                  {isApproving 
                    ? (it.approved && it.needsUpdate ? 'Updating…' : 'Approving…') 
                    : (it.approved && !it.needsUpdate ? 'Approved' : it.approved && it.needsUpdate ? 'Update' : 'Approve')}
                </button>
                <button style={btnDanger} disabled={isItemBusy} onClick={()=>handleDelete(it.file, it.userId)}>
                  {isDeleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          )})}
        </div>
      ) : null}
      {error && <p style={{ color:'#b91c1c', marginTop:12 }}>{error}</p>}
      
      {/* Change Request Modal */}
      {showChangeModal && (
        <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:24, zIndex:1000 }}>
          <div style={{ background:'#fff', borderRadius:12, padding:24, maxWidth:600, width:'100%', maxHeight:'80vh', overflow:'auto' }}>
            <h2 style={{ marginTop:0 }}>Request Changes</h2>
            <p style={{ color:'#555' }}>Describe the changes you want to make to this lesson:</p>
            <textarea
              style={{ width:'100%', minHeight:120, padding:'10px 12px', border:'1px solid #e5e7eb', borderRadius:8, fontFamily:'inherit', fontSize:14 }}
              value={changeRequests[showChangeModal.file] || ''}
              onChange={e=>setChangeRequests(prev=>({...prev, [showChangeModal.file]: e.target.value}))}
              placeholder="e.g., Add more examples about fractions, make questions easier, include word problems..."
            />
            <div style={{ marginTop:16, display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button style={btnSecondary} disabled={busy} onClick={closeChangeModal}>
                Cancel
              </button>
              <button style={btn} disabled={busy} onClick={handleRequestChanges}>
                {busy ? 'Applying…' : 'Apply Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
