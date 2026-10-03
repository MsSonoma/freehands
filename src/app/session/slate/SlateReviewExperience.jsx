'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { actOnFollowUp, getFollowUpRun } from '@/app/lib/followUpsClient'
import { normalizeReviewTeacher, reviewTeacherConfig } from '@/app/lib/reviewTeacher.js'
import { reviewTeacherDesign } from '@/app/lib/reviewTeacherDesign.mjs'

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

  const teacher = normalizeReviewTeacher(state?.run?.instructional_teacher)
  const teacherConfig = reviewTeacherConfig(teacher)
  const teacherDesign = reviewTeacherDesign(teacher)

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
  const styles = reviewStyles(teacherDesign)

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
          style={styles.teacherVideo}
        />
        <div>
          <div style={styles.name}>{teacherConfig.icon} {teacherConfig.displayName}</div>
          <div style={styles.label}>{label}</div>
        </div>
      </div>
      <button style={styles.headerGhost} onClick={() => router.push('/learn')}>BACK</button>
    </header>

    <section style={styles.card}>
      {!state && !error && <p style={styles.muted}>Loading review...</p>}
      {error && !state && <><h1>Review unavailable</h1><p style={styles.error}>{error}</p></>}
      {state && <>
        <div style={styles.progress}>{state.progress?.completed || 0} OF {state.progress?.total || 0}</div>
        {!started && !state.complete ? <div style={{ textAlign: 'center' }}>
          <h1 style={styles.title}>{state.progress?.total || 0}-question review</h1>
          <p style={styles.muted}>{teacherConfig.displayName.replaceAll('.', '')} will give this quiz.</p>
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
  const webb = teacher.id === 'webb'
  const sonoma = teacher.id === 'sonoma'
  const slate = teacher.id === 'slate'
  return {
    main: {
      minHeight: '100vh',
      background: teacher.page,
      color: teacher.text,
      fontFamily: teacher.fontFamily,
    },
    header: {
      padding: webb ? '10px 16px' : '14px 20px',
      borderBottom: `1px solid ${webb ? teacher.header : teacher.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      background: teacher.header,
      boxShadow: webb ? '0 2px 8px rgba(0,0,0,0.18)' : 'none',
    },
    teacherVideo: {
      width: webb ? 44 : 62,
      height: webb ? 44 : 62,
      objectFit: teacher.videoObjectFit,
      objectPosition: teacher.videoObjectPosition,
      borderRadius: webb ? 8 : 10,
      background: teacher.videoBackground,
    },
    name: {
      color: webb ? teacher.headerText : teacher.accent,
      fontWeight: 900,
      letterSpacing: teacher.labelLetterSpacing,
    },
    label: {
      color: webb ? teacher.headerMuted : teacher.muted,
      fontSize: 11,
      letterSpacing: webb ? 1 : teacher.labelLetterSpacing,
      marginTop: 3,
    },
    card: {
      maxWidth: sonoma ? 720 : 680,
      margin: webb ? '24px auto 72px' : sonoma ? '20px auto 72px' : '48px auto',
      background: teacher.surface,
      border: `1px solid ${webb ? teacher.softBorder : teacher.border}`,
      borderRadius: webb ? '4px 18px 18px 18px' : teacher.cardRadius,
      padding: webb ? '24px 22px' : 32,
      boxShadow: teacher.cardShadow,
      width: 'calc(100% - 32px)',
      boxSizing: 'border-box',
    },
    progress: {
      color: teacher.muted,
      fontSize: 11,
      letterSpacing: slate ? 2 : 0.5,
      marginBottom: 20,
    },
    title: {
      fontSize: 24,
      lineHeight: 1.4,
      margin: '0 0 24px',
      color: teacher.text,
    },
    input: {
      width: '100%',
      boxSizing: 'border-box',
      borderRadius: webb ? 12 : 8,
      border: `1px solid ${teacher.border}`,
      background: teacher.input,
      color: teacher.text,
      padding: 13,
      fontSize: 16,
      fontFamily: teacher.fontFamily,
      marginBottom: 12,
      outlineColor: teacher.accent,
    },
    choice: {
      border: '1px solid',
      borderRadius: webb ? 12 : 8,
      background: teacher.choice,
      color: teacher.text,
      padding: 12,
      textAlign: 'left',
      cursor: 'pointer',
      fontSize: 15,
      fontFamily: teacher.fontFamily,
      boxShadow: webb ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
    },
    primary: {
      border: 0,
      borderRadius: webb ? 10 : 8,
      background: teacher.accent,
      color: teacher.accentContrast,
      fontWeight: 900,
      padding: '11px 16px',
      cursor: 'pointer',
      fontFamily: teacher.fontFamily,
    },
    ghost: {
      border: `1px solid ${teacher.border}`,
      borderRadius: 8,
      background: teacher.surface,
      color: teacher.text,
      padding: '10px 14px',
      cursor: 'pointer',
      fontFamily: teacher.fontFamily,
    },
    headerGhost: {
      border: `1px solid ${webb ? 'rgba(255,255,255,0.35)' : teacher.border}`,
      borderRadius: 8,
      background: webb ? 'rgba(255,255,255,0.15)' : teacher.surface,
      color: webb ? '#fff' : teacher.text,
      padding: '10px 14px',
      cursor: 'pointer',
      fontFamily: teacher.fontFamily,
    },
    muted: { color: teacher.muted },
    error: { color: teacher.wrong },
    help: {
      color: teacher.text,
      background: slate ? 'rgba(210,153,34,.12)' : webb ? '#f0fdfa' : '#fff7ed',
      padding: 12,
      borderRadius: webb ? 12 : 8,
      border: webb ? `1px solid ${teacher.border}` : 'none',
    },
  }
}