'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { actOnFollowUp, getFollowUpRun } from '@/app/lib/followUpsClient'

export default function FollowUpPage() {
  const params = useParams()
  const router = useRouter()
  const runId = params?.runId
  const [state, setState] = useState(null)
  const [response, setResponse] = useState('')
  const [helpText, setHelpText] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const presentingRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getFollowUpRun(runId)
      .then((result) => {
        if (!cancelled) setState(result)
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError?.message || 'Follow-Up could not be loaded')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [runId])

  useEffect(() => {
    const item = state?.current_item
    if (!item || item.presented || !state?.enabled || feedback) return
    if (presentingRef.current === item.id) return
    presentingRef.current = item.id
    actOnFollowUp(runId, { action: 'present', item_id: item.id })
      .then((result) => {
        setState(result)
        setError('')
      })
      .catch((requestError) => setError(requestError?.message || 'Question could not be opened'))
      .finally(() => { presentingRef.current = null })
  }, [feedback, runId, state])

  const assist = async (kind) => {
    const itemId = state?.current_item?.id
    if (!itemId || busy) return
    setBusy(true)
    try {
      const result = await actOnFollowUp(runId, {
        action: 'assist',
        item_id: itemId,
        kind,
        request_id: globalThis.crypto?.randomUUID?.() || String(Date.now()),
      })
      if (kind === 'answer_reveal') setHelpText(result.help_text || 'Answer shown')
    } catch (requestError) {
      setError(requestError?.message || 'Help could not be loaded')
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    const itemId = state?.current_item?.id
    if (!itemId || !response.trim() || busy) return
    setBusy(true)
    try {
      const result = await actOnFollowUp(runId, {
        action: 'respond',
        item_id: itemId,
        response: response.trim(),
      })
      setState(result)
      setFeedback({
        acknowledgement: result.acknowledgement || 'Thanks for checking what you remember.',
        reviewRecommended: result.review_recommended === true,
        complete: result.complete === true,
      })
      setError('')
    } catch (requestError) {
      setError(requestError?.message || 'Answer could not be saved')
    } finally {
      setBusy(false)
    }
  }

  const continueReview = () => {
    setFeedback(null)
    setResponse('')
    setHelpText('')
  }

  const reviewLabel = state?.run?.review_type === 'weekly_review' ? 'Weekly Review' : 'Daily Follow-Up'
  const item = state?.current_item

  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px 14px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <button
          onClick={() => router.push('/learn/lessons')}
          style={{ border: 'none', background: 'none', color: '#475569', cursor: 'pointer', padding: '6px 0', marginBottom: 18 }}
        >← Back to Learn</button>

        <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 'clamp(20px, 5vw, 38px)', boxShadow: '0 16px 50px rgba(15, 23, 42, 0.07)' }}>
          {loading ? (
            <p style={{ color: '#64748b', textAlign: 'center' }}>Loading your Follow-Up…</p>
          ) : error && !state ? (
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ fontSize: 24 }}>This Follow-Up is unavailable</h1>
              <p style={{ color: '#64748b' }}>{error}</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'baseline', marginBottom: 26 }}>
                <div>
                  <div style={{ color: state?.run?.review_type === 'weekly_review' ? '#6d28d9' : '#1d4ed8', fontSize: 12, fontWeight: 800, letterSpacing: '.08em' }}>
                    {reviewLabel.toUpperCase()}
                  </div>
                  <h1 style={{ margin: '6px 0 0', fontSize: 26, color: '#0f172a' }}>What do you remember?</h1>
                </div>
                <span style={{ color: '#64748b', fontSize: 13, whiteSpace: 'nowrap' }}>
                  {state?.progress?.completed || 0} of {state?.progress?.total || 0}
                </span>
              </div>

              {feedback ? (
                <div style={{ textAlign: 'center', padding: '22px 0 8px' }}>
                  <div style={{ fontSize: 42, marginBottom: 10 }}>{feedback.reviewRecommended ? '🌱' : '✨'}</div>
                  <p style={{ fontSize: 19, fontWeight: 700, color: '#0f172a' }}>{feedback.acknowledgement}</p>
                  {feedback.reviewRecommended && (
                    <button
                      onClick={() => router.push('/learn/lessons')}
                      style={{ border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: 700, marginBottom: 14 }}
                    >Review the lesson library</button>
                  )}
                  <div>
                    <button style={primaryButton} onClick={feedback.complete ? () => router.push('/learn/lessons') : continueReview}>
                      {feedback.complete ? 'Done' : 'Next question'}
                    </button>
                  </div>
                </div>
              ) : state?.complete ? (
                <div style={{ textAlign: 'center', padding: '22px 0' }}>
                  <div style={{ fontSize: 42 }}>🎉</div>
                  <h2>All done</h2>
                  <p style={{ color: '#64748b' }}>Thanks for checking what you remember.</p>
                  <button style={primaryButton} onClick={() => router.push('/learn/lessons')}>Back to Learn</button>
                </div>
              ) : !state?.enabled && !item?.presented ? (
                <div style={{ textAlign: 'center' }}>
                  <h2>This Follow-Up is turned off</h2>
                  <p style={{ color: '#64748b' }}>Ask your facilitator if you should continue.</p>
                </div>
              ) : item ? (
                <div>
                  <p style={{ fontSize: 21, lineHeight: 1.45, color: '#0f172a', fontWeight: 650, marginBottom: 22 }}>
                    {item.content?.question}
                  </p>
                  {Array.isArray(item.content?.choices) && item.content.choices.length > 0 && (
                    <div style={{ display: 'grid', gap: 9, marginBottom: 18 }}>
                      {item.content.choices.map((choice, index) => (
                        <button
                          key={`${choice}-${index}`}
                          onClick={() => setResponse(String(choice))}
                          style={{
                            padding: '12px 14px', textAlign: 'left', borderRadius: 10,
                            border: response === String(choice) ? '2px solid #2563eb' : '1px solid #cbd5e1',
                            background: response === String(choice) ? '#eff6ff' : '#fff', cursor: 'pointer',
                          }}
                        >{choice}</button>
                      ))}
                    </div>
                  )}
                  <textarea
                    value={response}
                    onChange={(event) => setResponse(event.target.value)}
                    placeholder="Type what you remember"
                    rows={3}
                    style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: 13, border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 16, marginBottom: 12 }}
                  />
                  {helpText && <div style={{ background: '#fff7ed', color: '#9a3412', borderRadius: 10, padding: 12, marginBottom: 12 }}>{helpText}</div>}
                  {error && <p style={{ color: '#b91c1c', fontSize: 14 }}>{error}</p>}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: 9 }}>
                      <button style={secondaryButton} onClick={() => assist('repeat')} disabled={busy}>Repeat</button>
                      {item.content?.has_help && <button style={secondaryButton} onClick={() => assist('answer_reveal')} disabled={busy}>Show answer</button>}
                    </div>
                    <button style={{ ...primaryButton, opacity: !response.trim() || busy ? 0.55 : 1 }} onClick={submit} disabled={!response.trim() || busy}>
                      {busy ? 'Saving…' : 'Check answer'}
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </main>
  )
}

const primaryButton = {
  border: 'none', borderRadius: 10, padding: '11px 18px', background: '#2563eb', color: '#fff', fontWeight: 750, cursor: 'pointer',
}

const secondaryButton = {
  border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 14px', background: '#fff', color: '#334155', fontWeight: 650, cursor: 'pointer',
}
