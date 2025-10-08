'use client'
import { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { featuresForTier } from '@/app/lib/entitlements'


export default function GeneratedLessonsPage(){
  const [tier, setTier] = useState('free')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [textPreviews, setTextPreviews] = useState({}) // { [file]: string }
  const [changeRequests, setChangeRequests] = useState({}) // { [file]: string }
  const [showChangeModal, setShowChangeModal] = useState(null) // { file, userId } when modal open

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
    setBusy(true)
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
      setBusy(false)
    }
  }

  async function handleApprove(file, userId){
    console.log('[APPROVE] Starting approval for:', file, 'userId:', userId)
    setBusy(true)
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
      setBusy(false)
    }
  }

  function firstOf(obj, keys, fallback = undefined) {
    for (const k of keys) {
      const v = obj?.[k]
      if (v !== undefined && v !== null) return v
    }
    return fallback
  }

  function toArray(x) {
    if (!x) return []
    if (Array.isArray(x)) return x
    return [x]
  }

  function normalizeChoices(choices) {
    const arr = toArray(choices).map(c => {
      if (typeof c === 'string') return c
      if (!c || typeof c !== 'object') return ''
      return firstOf(c, ['text', 'label', 'choice', 'value'], JSON.stringify(c))
    })
    return arr.filter(Boolean)
  }

  function boolToWord(v) {
    const s = typeof v === 'string' ? v.trim().toLowerCase() : v
    if (s === true || s === 'true' || s === 't' || s === '1' || s === 'yes') return 'True'
    return 'False'
  }

  function coalesceTitle(obj, fallbackTitle) {
    return firstOf(obj, ['title', 'topic', 'name', 'lessonTitle'], fallbackTitle)
  }

  function renderLessonText(obj, file) {
    try {
      const lines = []
      const title = coalesceTitle(obj, file)
      const grade = firstOf(obj, ['grade', 'gradeLevel', 'level'], '—')
      const diff = firstOf(obj, ['difficulty', 'levelName'], '—')
      const subject = firstOf(obj, ['subject', 'category'], '—')
      lines.push(`# ${title}`)
      lines.push(`Grade: ${grade}  •  Difficulty: ${diff}  •  Subject: ${subject}`)
      lines.push('')

      const blurb = firstOf(obj, ['blurb', 'summary', 'overview', 'description'])
      if (blurb) { lines.push(blurb); lines.push('') }

      // Vocabulary
      let vocab = firstOf(obj, ['vocab', 'vocabulary', 'vocabularyTerms', 'terms'])
      if (vocab) {
        const list = toArray(vocab).map(v => {
          if (typeof v === 'string') return { term: v, def: '' }
          if (!v || typeof v !== 'object') return null
          const term = firstOf(v, ['term', 'word', 'title', 'name'], '')
          const def = firstOf(v, ['definition', 'def', 'meaning', 'explanation'], '')
          return term ? { term, def } : null
        }).filter(Boolean)
        if (list.length) {
          lines.push('Vocabulary:')
          for (const { term, def } of list) {
            lines.push(`- ${term}${def ? ` — ${def}` : ''}`)
          }
          lines.push('')
        }
      }

      // Teaching notes
      const notes = firstOf(obj, ['teachingNotes', 'teacherNotes', 'notes'])
      if (notes) {
        lines.push('Teaching Notes:')
        lines.push(typeof notes === 'string' ? notes : JSON.stringify(notes, null, 2))
        lines.push('')
      }

  // Collect questions across likely keys
      const sections = []
  const mc = toArray(firstOf(obj, ['multipleChoice', 'multiplechoice', 'mc']))
      if (mc.length) sections.push({ kind: 'Multiple Choice', items: mc })
  const tf = toArray(firstOf(obj, ['trueFalse', 'truefalse', 'tf', 'true_false']))
      if (tf.length) sections.push({ kind: 'True/False', items: tf })
  const sa = toArray(firstOf(obj, ['shortAnswer', 'shortanswer', 'sa', 'short_answer']))
      if (sa.length) sections.push({ kind: 'Short Answer', items: sa })
  const fib = toArray(firstOf(obj, ['fillInBlank', 'fillIn', 'fillInTheBlank', 'fill_in', 'fillintheblank']))
      if (fib.length) sections.push({ kind: 'Fill in the Blank', items: fib })
  const qa = toArray(firstOf(obj, ['qa', 'questions', 'q_a', 'qAndA']))
      if (qa.length) sections.push({ kind: 'Questions', items: qa })
  const sample = toArray(firstOf(obj, ['sample', 'qaSample', 'examples', 'qna', 'q_and_a']))
  if (sample.length) sections.push({ kind: 'Sample Q&A', items: sample })

      for (const sec of sections) {
        lines.push(sec.kind + ':')
        sec.items.forEach((qItem, idx) => {
          if (!qItem || typeof qItem !== 'object') {
            if (qItem) lines.push(`${idx + 1}. ${String(qItem)}`)
            return
          }
          const q = firstOf(qItem, ['q', 'Q', 'question', 'prompt', 'text'], '')
          const a = firstOf(qItem, ['a', 'A', 'answer', 'answers', 'solution', 'explanation', 'expected', 'expectedAny', 'sample'])
          if (sec.kind === 'Multiple Choice') {
            // Choices may be in 'choices', 'options', or an array under 'A' (variant)
            let choices = normalizeChoices(firstOf(qItem, ['choices', 'options']))
            if (!choices.length) choices = normalizeChoices(qItem.A)
            let answerText = ''
            const correctIndex = firstOf(qItem, ['correctIndex', 'answerIndex', 'CorrectIndex'])
            const correctLetter = firstOf(qItem, ['correct', 'Correct', 'letter'])
            const correctText = firstOf(qItem, ['correctAnswer', 'correctAnswerText'])
            if (typeof correctIndex === 'number' && choices[correctIndex] !== undefined) answerText = choices[correctIndex]
            else if (typeof a === 'number' && choices[a] !== undefined) answerText = choices[a]
            else if (typeof a === 'string') answerText = a
            else if (correctLetter && typeof correctLetter === 'string') {
              const idx = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(correctLetter.toUpperCase())
              if (idx >= 0 && choices[idx] !== undefined) answerText = choices[idx]
            }
            else if (typeof correctText === 'string') answerText = correctText
            lines.push(`${idx + 1}. ${q}`)
            choices.forEach((c, i) => {
              const letter = String.fromCharCode(65 + i)
              lines.push(`   ${letter}) ${c}`)
            })
            if (answerText) lines.push(`   Answer: ${answerText}`)
          } else if (sec.kind === 'True/False') {
            let ans = a
            if (ans === undefined) ans = firstOf(qItem, ['correct', 'Correct'])
            lines.push(`${idx + 1}. ${q} — Answer: ${boolToWord(ans)}`)
          } else if (sec.kind === 'Sample Q&A') {
            const ansText = Array.isArray(a) ? a.join(', ') : (a ?? firstOf(qItem, ['expectedAny', 'expected', 'answers']))
            const flatAns = Array.isArray(ansText) ? ansText.join(', ') : (ansText || '')
            lines.push(`${idx + 1}. ${q}`)
            if (flatAns) lines.push(`   Sample: ${flatAns}`)
          } else if (sec.kind === 'Fill in the Blank') {
            const ansText = Array.isArray(a) ? a.join(', ') : ((a ?? firstOf(qItem, ['expectedAny', 'expected', 'answers'])) || '')
            lines.push(`${idx + 1}. ${q}`)
            if (ansText) lines.push(`   Answer: ${ansText}`)
          } else if (sec.kind === 'Short Answer' || sec.kind === 'Questions') {
            const ansTextRaw = a ?? firstOf(qItem, ['expectedAny', 'expected', 'answers'])
            const ansText = Array.isArray(ansTextRaw) ? ansTextRaw.join('\n') : (ansTextRaw || '')
            lines.push(`${idx + 1}. ${q}`)
            if (ansText) lines.push(`   Sample: ${ansText}`)
          }
        })
        lines.push('')
      }

      if (lines[lines.length - 1] === '') lines.pop()
      return lines.join('\n')
    } catch (e) {
      return `Preview unavailable. ${e?.message || ''}`
    }
  }

  async function handlePreviewText(file, userId) {
    setBusy(true)
    setError('')
    try {
      const params = new URLSearchParams({ file, userId })
      const res = await fetch(`/api/facilitator/lessons/get?${params}`, { cache: 'no-store' })
      if (!res.ok) {
        const snippet = await res.text().catch(()=> '')
        setError(`Failed to load lesson JSON (${res.status}). ${snippet.slice(0, 120)}`)
        return
      }
      const data = await res.json()
      const text = renderLessonText(data, file)
      setTextPreviews(prev => ({ ...prev, [file]: text }))
    } finally {
      setBusy(false)
    }
  }

  function handleCloseTextPreview(file) {
    setTextPreviews(prev => {
      const next = { ...prev }
      delete next[file]
      return next
    })
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
      {!ent.facilitatorTools ? (
        <p>Premium required. <a href="/facilitator/plan">View plans</a>.</p>
      ) : loading ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <p>No generated lessons yet. Use Lesson Maker to create one.</p>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(520px, 1fr))', gap:12 }}>
          {items.map(it => {
            const isPreviewOpen = !!textPreviews[it.file]
            return (
            <div key={it.file} style={{ ...card, ...(isPreviewOpen ? { gridColumn:'1 / -1' } : null) }}>
              <h3 style={{ margin:'0 0 4px' }}>{it.title || it.file}</h3>
              <p style={{ margin:'0 0 8px', color:'#555' }}>Grade: {it.grade || '—'} · {it.difficulty || '—'} · Subject: {it.subject || '—'} {it.approved ? '· Approved' : ''}{it.needsUpdate ? ' · Needs Update' : ''}</p>
              <div style={{ display:'flex', gap:8, flexWrap:'nowrap' }}>
                <button style={btnSecondary} disabled={busy} onClick={()=>handlePreviewText(it.file, it.userId)}>
                  {busy ? 'Loading…' : (textPreviews[it.file] ? 'Refresh Preview' : 'Preview Text')}
                </button>
                <button style={btn} disabled={busy} onClick={()=>openChangeModal(it.file, it.userId)}>
                  Request Changes
                </button>
                <button style={{...btnApprove, ...(it.approved && !it.needsUpdate ? {opacity:0.5} : {})}} disabled={busy || (it.approved && !it.needsUpdate)} onClick={()=>handleApprove(it.file, it.userId)}>
                  {busy 
                    ? (it.approved && it.needsUpdate ? 'Updating…' : 'Approving…') 
                    : (it.approved && !it.needsUpdate ? 'Approved' : it.approved && it.needsUpdate ? 'Update' : 'Approve')}
                </button>
                <button style={btnDanger} disabled={busy} onClick={()=>handleDelete(it.file, it.userId)}>
                  {busy ? 'Deleting…' : 'Delete'}
                </button>
              </div>
              {textPreviews[it.file] && (
                <div style={{ marginTop:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, color:'#555' }}>
                    <span>Inline preview</span>
                    <button onClick={()=>handleCloseTextPreview(it.file)} style={{ ...btnSecondary, padding:'4px 8px' }}>Close</button>
                  </div>
                  <pre style={{ whiteSpace:'pre-wrap', wordBreak:'break-word', border:'1px solid #e5e7eb', borderRadius:8, padding:16, background:'#f9fafb', maxHeight:480, overflow:'auto', fontFamily:'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Noto Sans, "Apple Color Emoji", "Segoe UI Emoji"', fontSize:14, lineHeight:1.5 }}>
                    {textPreviews[it.file]}
                  </pre>
                </div>
              )}
            </div>
          )})}
        </div>
      )}
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
