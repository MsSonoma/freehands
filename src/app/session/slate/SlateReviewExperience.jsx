'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { actOnFollowUp, getFollowUpRun } from '@/app/lib/followUpsClient'

const VIDEO = '/media/Mr.%20Slate%20Suit.mp4'

export default function SlateReviewExperience({ runId }) {
  const router = useRouter()
  const [state, setState] = useState(null)
  const [response, setResponse] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [helpText, setHelpText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const presentingRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    getFollowUpRun(runId).then((result) => { if (!cancelled) setState(result) })
      .catch((cause) => { if (!cancelled) setError(cause?.message || 'This review is unavailable.') })
    return () => { cancelled = true }
  }, [runId])

  useEffect(() => {
    const item = state?.current_item
    if (!item || item.presented || !state?.enabled || feedback || presentingRef.current === item.id) return
    presentingRef.current = item.id
    actOnFollowUp(runId, { action: 'present', item_id: item.id })
      .then(setState).catch((cause) => setError(cause?.message || 'Question could not be opened.'))
      .finally(() => { presentingRef.current = null })
  }, [feedback, runId, state])

  const assist = async (kind) => {
    const item = state?.current_item
    if (!item || busy) return
    setBusy(true)
    try {
      const result = await actOnFollowUp(runId, {
        action: 'assist', item_id: item.id, kind,
        request_id: globalThis.crypto?.randomUUID?.() || String(Date.now()),
      })
      if (kind === 'answer_reveal') {
        setHelpText(result.help_text || 'Here is the answer. We will treat this as review, not an independent result.')
      }
    } catch (cause) { setError(cause?.message || 'Help could not be loaded.') }
    finally { setBusy(false) }
  }

  const submit = async () => {
    const item = state?.current_item
    if (!item || !response.trim() || busy) return
    setBusy(true)
    try {
      const result = await actOnFollowUp(runId, { action: 'respond', item_id: item.id, response: response.trim() })
      setState(result)
      setFeedback({ text: result.acknowledgement || (result.review_recommended ? 'Let’s work on that one again.' : 'You remembered it.'), complete: result.complete === true })
      setError('')
    } catch (cause) { setError(cause?.message || 'Your answer could not be saved.') }
    finally { setBusy(false) }
  }

  const next = () => { setFeedback(null); setResponse(''); setHelpText('') }
  const item = state?.current_item
  const label = state?.run?.review_type === 'weekly_review' ? 'WEEKLY REVIEW' : 'DAILY FOLLOW-UP'

  return <main style={styles.main}>
    <header style={styles.header}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <video src={VIDEO} muted playsInline autoPlay loop style={{ width: 52, height: 52, objectFit: 'contain' }} />
        <div><div style={styles.name}>MR. SLATE</div><div style={styles.label}>{label}</div></div>
      </div>
      <button style={styles.ghost} onClick={() => router.push('/learn')}>← BACK</button>
    </header>
    <section style={styles.card}>
      {!state && !error && <p style={styles.muted}>Loading review…</p>}
      {error && !state && <><h1>Review unavailable</h1><p style={styles.error}>{error}</p></>}
      {state && <>
        <div style={styles.progress}>{state.progress?.completed || 0} OF {state.progress?.total || 0}</div>
        {feedback ? <div style={{ textAlign: 'center' }}>
          <h1 style={styles.title}>{feedback.text}</h1>
          <button style={styles.primary} onClick={feedback.complete ? () => router.push('/learn') : next}>{feedback.complete ? 'DONE' : 'NEXT QUESTION'}</button>
        </div> : state.complete ? <div style={{ textAlign: 'center' }}>
          <h1 style={styles.title}>Review complete.</h1><button style={styles.primary} onClick={() => router.push('/learn')}>DONE</button>
        </div> : item ? <>
          <h1 style={styles.title}>{item.content?.question}</h1>
          {Array.isArray(item.content?.choices) && <div style={{ display: 'grid', gap: 9, marginBottom: 14 }}>{item.content.choices.map((choice) =>
            <button key={choice} style={{ ...styles.choice, borderColor: response === String(choice) ? '#58a6ff' : '#30363d' }} onClick={() => setResponse(String(choice))}>{choice}</button>)}</div>}
          <textarea style={styles.input} rows={3} value={response} onChange={(event) => setResponse(event.target.value)} placeholder="Type what you remember" />
          {helpText && <p style={styles.help}>{helpText}</p>}{error && <p style={styles.error}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={styles.ghost} disabled={busy} onClick={() => assist('repeat')}>REPEAT</button>
              {item.content?.has_help && <button style={styles.ghost} disabled={busy} onClick={() => assist('answer_reveal')}>SHOW ANSWER</button>}
            </div>
            <button style={styles.primary} disabled={busy || !response.trim()} onClick={submit}>{busy ? 'SAVING…' : 'CHECK ANSWER'}</button>
          </div>
        </> : !state.enabled ? <h1 style={styles.title}>This review is turned off.</h1> : null}
      </>}
    </section>
  </main>
}

const styles = {
  main: { minHeight: '100vh', background: '#0d1117', color: '#e6edf3', fontFamily: 'ui-monospace, monospace' },
  header: { padding: '14px 20px', borderBottom: '1px solid #30363d', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  name: { color: '#58a6ff', fontWeight: 900, letterSpacing: 2 }, label: { color: '#8b949e', fontSize: 11, letterSpacing: 2 },
  card: { maxWidth: 680, margin: '48px auto', background: '#161b22', border: '1px solid #30363d', borderRadius: 14, padding: 32 },
  progress: { color: '#8b949e', fontSize: 11, letterSpacing: 2, marginBottom: 20 }, title: { fontSize: 24, lineHeight: 1.4, margin: '0 0 24px' },
  input: { width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1px solid #30363d', background: '#0d1117', color: '#e6edf3', padding: 13, fontSize: 16, marginBottom: 12 },
  choice: { border: '1px solid', borderRadius: 8, background: '#1c2128', color: '#e6edf3', padding: 12, textAlign: 'left', cursor: 'pointer' },
  primary: { border: 0, borderRadius: 7, background: '#58a6ff', color: '#0d1117', fontWeight: 900, padding: '11px 16px', cursor: 'pointer' },
  ghost: { border: '1px solid #30363d', borderRadius: 7, background: 'transparent', color: '#e6edf3', padding: '10px 14px', cursor: 'pointer' },
  muted: { color: '#8b949e' }, error: { color: '#f85149' }, help: { color: '#d29922', background: 'rgba(210,153,34,.12)', padding: 12, borderRadius: 8 },
}
