'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { actOnFollowUp, getFollowUpRun } from '@/app/lib/followUpsClient'

const TEACHERS = Object.freeze({
  sonoma: {
    id: 'sonoma',
    name: 'MS. SONOMA',
    video: '/media/ms-sonoma-3.mp4',
    tts: '/api/tts',
    accent: '#6b4f3a',
    background: '#f4efe8',
    surface: '#fffaf4',
    text: '#332b25',
    muted: '#756c64',
    border: '#d7c8b9',
    choice: '#fff',
  },
  webb: {
    id: 'webb',
    name: 'MRS. WEBB',
    video: '/media/webb-teacher.mp4',
    tts: '/api/webb-tts',
    accent: '#7b3f66',
    background: '#f7f0f5',
    surface: '#fffafd',
    text: '#362a33',
    muted: '#756974',
    border: '#dccbd8',
    choice: '#fff',
  },
  slate: {
    id: 'slate',
    name: 'MR. SLATE',
    video: '/media/Mr.%20Slate%20Suit.mp4',
    tts: '/api/slate-tts',
    accent: '#58a6ff',
    background: '#0d1117',
    surface: '#161b22',
    text: '#e6edf3',
    muted: '#8b949e',
    border: '#30363d',
    choice: '#1c2128',
  },
})

function normalizeTeacher(value) {
  const teacher = String(value || '').trim().toLowerCase()
  return TEACHERS[teacher] ? teacher : 'slate'
}

function reviewLabel(reviewType) {
  if (reviewType === 'weekly_review') return 'WEEKLY REVIEW'
  if (reviewType === 'daily_review') return 'DAILY REVIEW'
  return 'DAILY FOLLOW-UP'
}

function spokenQuestion(content = {}) {
  const question = String(content.question || '').trim()
  const choices = Array.isArray(content.choices) ? content.choices.filter(Boolean) : []
  if (!choices.length) return question
  const spokenChoices = choices.map((choice, index) => `${String.fromCharCode(65 + index)}. ${choice}`).join('. ')
  return `${question} ${spokenChoices}`
}

function audioSource(value) {
  const audio = String(value || '').trim()
  if (!audio) return ''
  if (/^(data:|blob:|https?:)/i.test(audio)) return audio
  return `data:audio/mp3;base64,${audio}`
}

export default function SlateReviewExperience({ runId }) {
  const router = useRouter()
  const [state, setState] = useState(null)
  const [response, setResponse] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [helpText, setHelpText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [started, setStarted] = useState(false)
  const presentingRef = useRef(null)
  const spokenItemRef = useRef('')
  const videoRef = useRef(null)
  const audioRef = useRef(null)
  const speechGenerationRef = useRef(0)

  const teacher = normalizeTeacher(state?.run?.instructional_teacher)
  const teacherConfig = TEACHERS[teacher]

  const stopSpeech = useCallback(() => {
    speechGenerationRef.current += 1
    try {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.onended = null
        audioRef.current.onerror = null
      }
    } catch {}
    audioRef.current = null
    try { videoRef.current?.pause?.() } catch {}
  }, [])

  const speakTeacher = useCallback(async (text) => {
    const spoken = String(text || '').trim()
    if (!spoken) return
    stopSpeech()
    const generation = speechGenerationRef.current
    try {
      const response = await fetch(teacherConfig.tts, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: spoken }),
      })
      if (!response.ok || speechGenerationRef.current !== generation) {
        try { videoRef.current?.pause?.() } catch {}
        return
      }
      const payload = await response.json().catch(() => ({}))
      const src = audioSource(payload?.audio)
      if (!src || speechGenerationRef.current !== generation) {
        try { videoRef.current?.pause?.() } catch {}
        return
      }

      await new Promise((resolve) => {
        const audio = new Audio(src)
        audioRef.current = audio
        const done = () => {
          if (audioRef.current === audio) audioRef.current = null
          try { videoRef.current?.pause?.() } catch {}
          resolve()
        }
        audio.onended = done
        audio.onerror = done
        try { videoRef.current?.play?.().catch?.(() => {}) } catch {}
        audio.play().catch(done)
      })
    } catch {
      try { videoRef.current?.pause?.() } catch {}
    }
  }, [stopSpeech, teacherConfig.tts])

  useEffect(() => {
    let cancelled = false
    getFollowUpRun(runId).then((result) => { if (!cancelled) setState(result) })
      .catch((cause) => { if (!cancelled) setError(cause?.message || 'This review is unavailable.') })
    return () => {
      cancelled = true
      stopSpeech()
    }
  }, [runId, stopSpeech])

  useEffect(() => {
    const item = state?.current_item
    if (!started || !item || item.presented || !state?.enabled || feedback || presentingRef.current === item.id) return
    presentingRef.current = item.id
    actOnFollowUp(runId, { action: 'present', item_id: item.id })
      .then(setState)
      .catch((cause) => setError(cause?.message || 'Question could not be opened.'))
      .finally(() => { presentingRef.current = null })
  }, [feedback, runId, started, state])

  useEffect(() => {
    const item = state?.current_item
    if (!started || !item || !item.presented || feedback || !state?.enabled || spokenItemRef.current === item.id) return
    spokenItemRef.current = item.id
    void speakTeacher(spokenQuestion(item.content))
  }, [feedback, speakTeacher, started, state?.current_item?.id, state?.current_item?.presented, state?.enabled])

  const beginQuiz = () => {
    try {
      const silent = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA')
      silent.muted = true
      silent.volume = 0
      silent.play().catch(() => {})
    } catch {}
    try {
      const play = videoRef.current?.play?.()
      play?.catch?.(() => {})
    } catch {}
    setStarted(true)
  }
  const assist = async (kind) => {
    const item = state?.current_item
    if (!item || busy) return
    setBusy(true)
    try {
      const result = await actOnFollowUp(runId, {
        action: 'assist',
        item_id: item.id,
        kind,
        request_id: globalThis.crypto?.randomUUID?.() || String(Date.now()),
      })
      if (kind === 'repeat') {
        await speakTeacher(spokenQuestion(item.content))
      } else if (kind === 'answer_reveal') {
        const text = result.help_text || 'Here is the answer. We will treat this as review, not an independent result.'
        setHelpText(text)
        await speakTeacher(text)
      }
    } catch (cause) {
      setError(cause?.message || 'Help could not be loaded.')
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    const item = state?.current_item
    if (!item || !response.trim() || busy) return
    setBusy(true)
    try {
      const result = await actOnFollowUp(runId, { action: 'respond', item_id: item.id, response: response.trim() })
      const acknowledgement = result.acknowledgement || (result.review_recommended ? 'We will work on that one again.' : 'You remembered it.')
      setState(result)
      setFeedback({ text: acknowledgement, complete: result.complete === true })
      setError('')
      await speakTeacher(acknowledgement)
    } catch (cause) {
      setError(cause?.message || 'Your answer could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const next = () => {
    stopSpeech()
    setFeedback(null)
    setResponse('')
    setHelpText('')
  }

  const item = state?.current_item
  const label = reviewLabel(state?.run?.review_type)
  const styles = reviewStyles(teacherConfig)

  return <main style={styles.main}>
    <header style={styles.header}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <video
          ref={videoRef}
          src={teacherConfig.video}
          muted
          playsInline
          loop
          preload="auto"
          style={{ width: 62, height: 62, objectFit: 'contain', borderRadius: 10 }}
        />
        <div>
          <div style={styles.name}>{teacherConfig.name}</div>
          <div style={styles.label}>{label}</div>
        </div>
      </div>
      <button style={styles.ghost} onClick={() => router.push('/learn')}>BACK</button>
    </header>

    <section style={styles.card}>
      {!state && !error && <p style={styles.muted}>Loading review...</p>}
      {error && !state && <><h1>Review unavailable</h1><p style={styles.error}>{error}</p></>}
      {state && <>
        <div style={styles.progress}>{state.progress?.completed || 0} OF {state.progress?.total || 0}</div>
        {!started && !state.complete ? <div style={{ textAlign: 'center' }}>
          <h1 style={styles.title}>{state.progress?.total || 0}-question review</h1>
          <p style={styles.muted}>{teacherConfig.name.replaceAll('.', '')} will give this quiz.</p>
          <button style={styles.primary} onClick={beginQuiz}>BEGIN QUIZ</button>
        </div> : feedback ? <div style={{ textAlign: 'center' }}>
          <h1 style={styles.title}>{feedback.text}</h1>
          <button style={styles.primary} onClick={feedback.complete ? () => router.push('/learn') : next}>
            {feedback.complete ? 'DONE' : 'NEXT QUESTION'}
          </button>
        </div> : state.complete ? <div style={{ textAlign: 'center' }}>
          <h1 style={styles.title}>Review complete.</h1>
          <button style={styles.primary} onClick={() => router.push('/learn')}>DONE</button>
        </div> : item ? <>
          <h1 style={styles.title}>{item.content?.question}</h1>
          {Array.isArray(item.content?.choices) && <div style={{ display: 'grid', gap: 9, marginBottom: 14 }}>
            {item.content.choices.map((choice) =>
              <button
                key={choice}
                style={{ ...styles.choice, borderColor: response === String(choice) ? teacherConfig.accent : teacherConfig.border }}
                onClick={() => setResponse(String(choice))}
              >
                {choice}
              </button>)}
          </div>}
          {!Array.isArray(item.content?.choices) && <textarea
            style={styles.input}
            rows={3}
            value={response}
            onChange={(event) => setResponse(event.target.value)}
            placeholder="Type what you remember"
          />}
          {helpText && <p style={styles.help}>{helpText}</p>}
          {error && <p style={styles.error}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={styles.ghost} disabled={busy} onClick={() => assist('repeat')}>REPEAT</button>
              {item.content?.has_help && <button style={styles.ghost} disabled={busy} onClick={() => assist('answer_reveal')}>SHOW ANSWER</button>}
            </div>
            <button style={styles.primary} disabled={busy || !response.trim()} onClick={submit}>
              {busy ? 'SAVING...' : 'CHECK ANSWER'}
            </button>
          </div>
        </> : !state.enabled ? <h1 style={styles.title}>This review is turned off.</h1> : null}
      </>}
    </section>
  </main>
}

function reviewStyles(teacher) {
  return {
    main: { minHeight: '100vh', background: teacher.background, color: teacher.text, fontFamily: 'system-ui, sans-serif' },
    header: { padding: '14px 20px', borderBottom: `1px solid ${teacher.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: teacher.surface },
    name: { color: teacher.accent, fontWeight: 900, letterSpacing: 1.4 },
    label: { color: teacher.muted, fontSize: 11, letterSpacing: 2, marginTop: 3 },
    card: { maxWidth: 680, margin: '48px auto', background: teacher.surface, border: `1px solid ${teacher.border}`, borderRadius: 14, padding: 32, boxShadow: teacher.id === 'slate' ? 'none' : '0 8px 30px rgba(0,0,0,.06)' },
    progress: { color: teacher.muted, fontSize: 11, letterSpacing: 2, marginBottom: 20 },
    title: { fontSize: 24, lineHeight: 1.4, margin: '0 0 24px' },
    input: { width: '100%', boxSizing: 'border-box', borderRadius: 8, border: `1px solid ${teacher.border}`, background: teacher.choice, color: teacher.text, padding: 13, fontSize: 16, marginBottom: 12 },
    choice: { border: '1px solid', borderRadius: 8, background: teacher.choice, color: teacher.text, padding: 12, textAlign: 'left', cursor: 'pointer', fontSize: 15 },
    primary: { border: 0, borderRadius: 7, background: teacher.accent, color: teacher.id === 'slate' ? '#0d1117' : '#fff', fontWeight: 900, padding: '11px 16px', cursor: 'pointer' },
    ghost: { border: `1px solid ${teacher.border}`, borderRadius: 7, background: 'transparent', color: teacher.text, padding: '10px 14px', cursor: 'pointer' },
    muted: { color: teacher.muted },
    error: { color: '#b42318' },
    help: { color: teacher.text, background: teacher.id === 'slate' ? 'rgba(210,153,34,.12)' : 'rgba(0,0,0,.045)', padding: 12, borderRadius: 8 },
  }
}
