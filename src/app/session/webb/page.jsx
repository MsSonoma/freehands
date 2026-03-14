'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'

// CSS animations
if (typeof document !== 'undefined' && !document.getElementById('webb-spin-style')) {
  const s = document.createElement('style')
  s.id = 'webb-spin-style'
  s.textContent = [
    '@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }',
    '@keyframes webb-bounce { 0%,80%,100% { transform:translateY(0) } 40% { transform:translateY(-5px) } }',
    '@keyframes webb-tablet-in { 0% { opacity:0; transform:translateX(-50%) scale(0.88) } 100% { opacity:1; transform:translateX(-50%) scale(1) } }',
    '@keyframes webb-tablet-out { 0% { opacity:1; transform:translateX(-50%) scale(1) } 100% { opacity:0; transform:translateX(-50%) scale(0.92) } }',
  ].join(' ')
  document.head.appendChild(s)
}

// ── Color tokens ──────────────────────────────────────────────────────────────
const C = {
  accent:      '#0d9488',
  accentDark:  '#0f766e',
  accentLight: '#ccfbf1',
  border:      '#99f6e4',
  muted:       '#6b7280',
  text:        '#111827',
  danger:      '#ef4444',
  success:     '#10b981',
}

const PHASE = { LIST: 'list', STARTING: 'starting', CHATTING: 'chatting' }

// ── UI FAQ: feature explanations in Mrs. Webb's voice ─────────────────────────
const UI_FAQ = {
  video: {
    keywords: ['video', 'watch', 'play', 'movie', 'film', 'youtube', 'player'],
    confirm: 'Are you wondering about the video feature?',
    answer: 'To watch a video, just tap the video button — it looks like ▶ — at the bottom of my screen. That opens a little video player with play, pause, and a timeline. The video is picked specially for your lesson!',
    location: 'tap the ▶ button at the bottom of my screen',
    actionPrompt: 'Want me to open the video for you right now?',
    actionSlug: 'video',
  },
  article: {
    keywords: ['article', 'read', 'wiki', 'wikipedia', 'reading', 'text', 'page'],
    confirm: 'Are you wondering about the article feature?',
    answer: 'The article button — it looks like 📖 — opens a Wikipedia article about your lesson right inside this screen. It is a great way to read a bit more about what we are studying!',
    location: 'tap the 📖 button at the bottom of my screen',
    actionPrompt: 'Would you like me to open the article for you?',
    actionSlug: 'article',
  },
  keypart: {
    keywords: ['key part', 'highlight', 'important part', 'read aloud', 'interpret', 'magnify', 'underline', 'find the'],
    confirm: 'Are you wondering about the Key part feature?',
    answer: 'The Key part button — it looks like a magnifying glass with a plus sign — lives in the article toolbar. Tap it and I will find the most important sentences, highlight them in yellow, and read them to you one by one. It is like having me point to the page!',
    actionPrompt: null,
    actionSlug: null,
  },
  move: {
    keywords: ['move', 'arrow', 'switch side', 'other side', 'reposition', 'swap', 'slide'],
    confirm: 'Are you wondering how to move the video or article window?',
    answer: 'The arrow button in the toolbar slides the video or article window between two spots — over my camera or over our chat. Just tap the arrow and it jumps to the other side!',
    actionPrompt: null,
    actionSlug: null,
  },
  fullscreen: {
    keywords: ['fullscreen', 'full screen', 'bigger', 'expand', 'large', 'maximize', 'enlarge'],
    confirm: 'Are you wondering how to make the video or article bigger?',
    answer: 'The expand icon in the toolbar — four little arrows pointing outward — makes the video or article fill the whole screen. Tap it again to go back to normal.',
    actionPrompt: null,
    actionSlug: null,
  },
  refresh: {
    keywords: ['refresh', 'different video', 'different article', 'try another', 'new video', 'new article', 'change video', 'change article'],
    confirm: 'Are you wondering how to get a different video or article?',
    answer: 'The little ↻ button in the top-left of the toolbar loads a brand-new video or article for your lesson. Just tap it and I will find something different!',
    actionPrompt: null,
    actionSlug: null,
  },
  mute: {
    keywords: ['mute', 'volume', 'sound', 'quiet', 'loud', 'speaker', 'audio', 'hear me', 'voice'],
    confirm: 'Are you wondering about the sound or mute feature?',
    answer: 'There is a speaker icon at the bottom right of the screen that mutes or unmutes my voice. Inside the video player there is a separate mute button just for the video. So you can control each one independently!',
    actionPrompt: null,
    actionSlug: null,
  },
  close: {
    keywords: ['close', 'hide', 'get rid of', 'remove', 'dismiss', 'go away', 'shut'],
    confirm: 'Are you wondering how to close the video or article?',
    answer: 'The ✕ button in the top-right corner of the toolbar closes the video or article window. You can reopen it any time by tapping the ▶ or 📖 button again!',
    actionPrompt: null,
    actionSlug: null,
  },
  skip: {
    keywords: ['skip', 'skip question', 'next question', 'pass', 'skip button'],
    confirm: 'Are you wondering about the Skip button?',
    answer: 'The Skip button at the bottom right of the screen lets you move past a question if you are stuck or want to come back to it later. It is totally okay to skip — curiosity goes at your own pace!',
    actionPrompt: null,
    actionSlug: null,
  },
  exit: {
    keywords: ['exit', 'go back', 'leave', 'quit', 'finish', 'end session', 'stop session', 'how do i leave'],
    confirm: 'Are you wondering how to exit or go back?',
    answer: 'The back arrow at the very top-left takes you back to the lesson list. There is also an Exit button that will check for a PIN before closing — that is just so a lesson does not end by accident!',
    actionPrompt: null,
    actionSlug: null,
  },
  help: {
    keywords: ['help', 'what can i do', 'what buttons', 'features', 'how does this work', 'what is this', 'how do i use'],
    confirm: 'Are you asking for a quick tour of what I can do?',
    answer: 'Sure! At the bottom of my screen you will find a ▶ video button and a 📖 article button — those pull up extra learning materials just for your lesson. Once open, the toolbar has a ↻ refresh for new content, an arrow to move the window around, a fullscreen button, and a ✕ to close it. The article even has a Key part button that highlights the most important sentences and reads them to you. And the speaker icon in the corner mutes my voice. What would you like to try first?',
    actionPrompt: null,
    actionSlug: null,
  },
}

function detectUiQuestion(text) {
  const lower = text.toLowerCase()
  const isQuestion =
    lower.includes('?') ||
    /\b(how|what|where|why|which|explain|describe|tell me|show me|can i|can we|can you|do i|does|help|what is|what's|button|feature|work|use|want to|would like|wanna|i'd like|let me|let's|i need)\b/.test(lower)
  if (!isQuestion) return null
  for (const [slug, cfg] of Object.entries(UI_FAQ)) {
    if (cfg.keywords.some(kw => lower.includes(kw))) return slug
  }
  return null
}

function isYes(text) {
  return /^\s*(yes|yeah|yep|yup|sure|ok|okay|please|do it|go ahead|open it|show me|definitely|of course|affirmative|sounds good|great|cool|alright|why not|let'?s go|uh huh|mhm|yea|ya|k|👍)\b/i.test(text)
}

function isNo(text) {
  return /^\s*(no|nope|nah|never ?mind|not now|don'?t|that'?s ok|i'?m good|no thanks|no thank you|skip it|forget it|it'?s fine|cancel|nvm|👎)\b/i.test(text)
}

// ── Root page ─────────────────────────────────────────────────────────────────
export default function WebbPage() {
  const router = useRouter()

  // ── Lesson browser state ─────────────────────────────────────────────
  const [phase, setPhase]                       = useState(PHASE.LIST)
  const [availableLessons, setAvailableLessons] = useState([])
  const [allOwnedLessons, setAllOwnedLessons]   = useState([])
  const [recentSessions, setRecentSessions]     = useState([])
  const [historyLessons, setHistoryLessons]     = useState({})
  const [listTab, setListTab]                   = useState('active')
  const [ownedFilters, setOwnedFilters]         = useState({ subject: '', grade: '' })
  const [listError, setListError]               = useState('')
  const [learnerId, setLearnerId]               = useState(null)
  const [pageError, setPageError]               = useState('')

  // ── Active lesson ────────────────────────────────────────────────────
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [chatMessages, setChatMessages]     = useState([]) // [{role,content}] for API
  const [transcript, setTranscript]         = useState([]) // [{text,role}] for CaptionPanel
  const [activeIndex, setActiveIndex]       = useState(-1)
  const [chatLoading, setChatLoading]       = useState(false)
  const transcriptRef                       = useRef(null)

  // ── Research objectives ──────────────────────────────────────────────
  const [objectives,         setObjectives]        = useState([])  // string[]
  const [completedObj,       setCompletedObj]      = useState([])  // number[] of completed indices
  const [newlyCompletedObj,  setNewlyCompletedObj] = useState(null) // {idx, text} — drives tablet toast
  const checkingObjRef = useRef(false) // debounce concurrent checks

  // ── Media resources ──────────────────────────────────────────────────
  const [videoResource, setVideoResource]       = useState(null) // {videoId,embedUrl,title,channel} or {unavailable:true}
  const [articleResource, setArticleResource]   = useState(null) // {html, source, title} — HTML fetched server-side
  const [videoLoading, setVideoLoading]         = useState(false)
  const [articleLoading, setArticleLoading]     = useState(false)
  const [mediaOverlay, setMediaOverlay]         = useState(null) // 'video'|'article'|null
  const [refreshingMedia, setRefreshingMedia]       = useState(false)
  const [interpretingArticle, setInterpretingArticle] = useState(false)
  const [interpretingVideo,   setInterpretingVideo]   = useState(false)
  const [videoMoments,        setVideoMoments]         = useState([])
  const segmentEndRef       = useRef(null) // endSeconds of active playback segment
  const videoCurrentTimeRef = useRef(0)    // mirrors videoCurrentTime for async polling
  // Passage excerpts are stored so highlights can be re-applied if the iframe remounts
  const [articlePassageExcerpts, setArticlePassageExcerpts] = useState([])
  // Tracks video IDs already shown so refresh never repeats
  const shownVideoIdsRef = useRef([])
  const articleIframeRef = useRef(null)
  // Media overlay position + fullscreen
  const [mediaPos, setMediaPos]               = useState('video') // 'video'|'chat'
  const [mediaIsFullscreen, setMediaIsFullscreen] = useState(false)
  const mediaOverlayRef = useRef(null)
  const chatColRef      = useRef(null)
  const videoInnerRef   = useRef(null)
  const [overlayRect, setOverlayRect]         = useState(null)
  // YouTube end-screen: true once the player posts a 'ended' state message
  const [videoEnded, setVideoEnded]           = useState(false)
  // Custom player controls state
  const [videoPlaying, setVideoPlaying]       = useState(false)
  const [videoDuration, setVideoDuration]     = useState(0)
  const [videoCurrentTime, setVideoCurrentTime] = useState(0)
  const [videoVolumeMuted, setVideoVolumeMuted] = useState(false)
  const videoIframeRef = useRef(null)
  // Passage citation — highlight els + scroll-override tracking
  const passageEls             = useRef([])     // highlight <span>s created by interpretArticle
  const userScrolledArticleRef = useRef(false)  // true after a manual scroll in the article
  const programmaticScrollRef  = useRef(false)  // true during our own scrollIntoView calls
  // UI FAQ intercept state
  const uiFaqPendingRef       = useRef(null)  // slug of feature being confirmed
  const uiFaqActionPendingRef = useRef(false) // waiting for action yes/no

  // Reset all player state whenever a new video arrives
  useEffect(() => {
    setVideoEnded(false)
    setVideoPlaying(false)
    setVideoDuration(0)
    setVideoCurrentTime(0)
    setVideoVolumeMuted(false)
    setVideoMoments([])
    segmentEndRef.current = null
  }, [videoResource?.videoId])

  // YouTube IFrame API posts postMessage events when enablejsapi=1.
  // We receive state changes and periodic time/duration info here.
  useEffect(() => {
    function handleYTMessage(e) {
      if (!e.data) return
      try {
        const msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (msg.event === 'onStateChange') {
          const s = msg.info
          if (s === 0) setVideoEnded(true)
          setVideoPlaying(s === 1)
        }
        if ((msg.event === 'infoDelivery' || msg.event === 'initialDelivery') && msg.info) {
          if (typeof msg.info.currentTime === 'number') { setVideoCurrentTime(msg.info.currentTime); videoCurrentTimeRef.current = msg.info.currentTime }
          if (typeof msg.info.duration    === 'number' && msg.info.duration > 0) setVideoDuration(msg.info.duration)
          if (typeof msg.info.muted       === 'boolean') setVideoVolumeMuted(msg.info.muted)
          if (typeof msg.info.playerState === 'number') {
            if (msg.info.playerState === 0) setVideoEnded(true)
            setVideoPlaying(msg.info.playerState === 1)
          }
        }
      } catch { /* non-JSON messages — ignore */ }
    }
    window.addEventListener('message', handleYTMessage)
    return () => window.removeEventListener('message', handleYTMessage)
  }, [])

  // Auto-pause when videoCurrentTime reaches the end of the active segment
  useEffect(() => {
    if (segmentEndRef.current !== null && videoCurrentTime >= segmentEndRef.current) {
      ytCmd('pauseVideo')
      segmentEndRef.current = null
    }
  }, [videoCurrentTime]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Video / TTS ──────────────────────────────────────────────────────
  const videoRef      = useRef(null)
  const ttsQueueRef   = useRef([])
  const ttsBusyRef    = useRef(false)
  const ttsCurrentRef = useRef(null)
  const [engineState, setEngineState] = useState('idle')
  const [isMuted, setIsMuted]         = useState(false)
  const isMutedRef                    = useRef(false)

  // ── YouTube player commands (via IFrame API postMessage) ──────────────
  function ytCmd(func, args = []) {
    videoIframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args }), '*'
    )
  }
  function formatVideoTime(s) {
    if (!s || !isFinite(s)) return '0:00'
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`
  }

  // ── Chat scroll ─────────────────────────────────────────────────────
  const chatEndRef = useRef(null)

  // Auto-scroll to newest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [transcript.length, chatLoading])

  // ── Layout ───────────────────────────────────────────────────────────
  const videoColRef                         = useRef(null)
  const [isMobileLandscape, setIsLandscape] = useState(false)
  const [videoMaxHeight, setVideoMaxHeight] = useState(null)
  const [videoColPercent, setVideoColPct]   = useState(50)
  const [sideBySideHeight, setSBSH]         = useState(null)

  const learnerName = useRef('')

  // ── Init ─────────────────────────────────────────────────────────────
  useEffect(() => {
    try { learnerName.current = localStorage.getItem('learner_name') || '' } catch {}
    const id = (() => { try { return localStorage.getItem('learner_id') || null } catch { return null } })()
    setLearnerId(id)
    loadLessons(id)
  }, [])

  useEffect(() => { isMutedRef.current = isMuted }, [isMuted])

  // ── Orientation detection ─────────────────────────────────────────────
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      const land = w > h
      setIsLandscape(land)
      if (!land) { setVideoMaxHeight(null); setVideoColPct(45); return }
      let frac
      if (h <= 375)       frac = 0.40
      else if (h <= 600)  frac = 0.40 + ((h - 375) / 225) * 0.25
      else if (h <= 700)  frac = 0.65 + ((h - 600) / 100) * 0.05
      else if (h <= 1000) frac = 0.70 + ((h - 700) / 300) * 0.05
      else                frac = 0.75
      setVideoMaxHeight(Math.round(h * frac))
      setVideoColPct(50)
    }
    calc()
    window.addEventListener('resize', calc)
    window.addEventListener('orientationchange', calc)
    let vv = null
    try { vv = window.visualViewport || null } catch {}
    if (vv) { try { vv.addEventListener('resize', calc) } catch {} }
    return () => {
      window.removeEventListener('resize', calc)
      window.removeEventListener('orientationchange', calc)
      if (vv) { try { vv.removeEventListener('resize', calc) } catch {} }
    }
  }, [])

  // Measure video column height
  useEffect(() => {
    if (!isMobileLandscape) { setSBSH(null); return }
    const v = videoColRef.current
    if (!v) return
    const measure = () => {
      try {
        const h = v.getBoundingClientRect().height
        if (Number.isFinite(h) && h > 0) setSBSH(prev => prev !== Math.round(h) ? Math.round(h) : prev)
      } catch {}
    }
    measure()
    let ro
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure)
      try { ro.observe(v) } catch {}
    } else { window.addEventListener('resize', measure) }
    return () => {
      try { ro?.disconnect() } catch {}
      window.removeEventListener('resize', measure)
    }
  }, [isMobileLandscape, videoMaxHeight])

  // ── TTS queue ─────────────────────────────────────────────────────────
  async function drainTTSQueue() {
    if (ttsBusyRef.current) return
    const text = ttsQueueRef.current.shift()
    if (!text) return
    ttsBusyRef.current = true
    if (!isMutedRef.current) {
      try {
        const res = await fetch('/api/webb-tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })
        const data = await res.json()
        const audioUrl = data.audio
        if (audioUrl && !isMutedRef.current) {
          await new Promise((resolve) => {
            const audio = new Audio(audioUrl)
            ttsCurrentRef.current = audio
            setEngineState('playing')
            try { videoRef.current?.play() } catch {}
            const done = () => {
              if (ttsCurrentRef.current === audio) ttsCurrentRef.current = null
              if (!ttsQueueRef.current.length) {
                setEngineState('idle')
                try { if (videoRef.current) videoRef.current.pause() } catch {}
              }
              resolve()
            }
            audio.onended = done
            audio.onerror = done
            audio.play().catch(done)
          })
        }
      } catch {
        setEngineState('idle')
        try { if (videoRef.current) videoRef.current.pause() } catch {}
      }
    }
    ttsBusyRef.current = false
    if (ttsQueueRef.current.length > 0) { drainTTSQueue() }
    else {
      setEngineState('idle')
      try { if (videoRef.current) videoRef.current.pause() } catch {}
    }
  }

  function speakText(text) {
    const t = String(text || '').trim()
    if (!t) return
    ttsQueueRef.current.push(t)
    drainTTSQueue()
  }

  function skipTTS() {
    ttsQueueRef.current = []
    if (ttsCurrentRef.current) {
      ttsCurrentRef.current.pause()
      ttsCurrentRef.current.onended = null
      ttsCurrentRef.current = null
    }
    ttsBusyRef.current = false
    setEngineState('idle')
    try { if (videoRef.current) videoRef.current.pause() } catch {}
  }

  function toggleMute() {
    setIsMuted(prev => {
      const next = !prev
      isMutedRef.current = next
      if (next) skipTTS()
      return next
    })
  }

  // ── Transcript helpers ────────────────────────────────────────────────
  function addMsg(text) {
    const t = String(text || '').trim()
    if (!t) return
    setTranscript(prev => {
      const next = [...prev, { text: t, role: 'assistant' }]
      setActiveIndex(next.length - 1)
      return next
    })
    speakText(t)
  }

  function addStudentLine(text) {
    const t = String(text || '').trim()
    if (!t) return
    setTranscript(prev => [...prev, { text: t, role: 'user' }])
  }

  // Like addMsg but tags the transcript entry with a passage index so the
  // bubble renderer can show a citation link back to the article highlight.
  function addPassageMsg(text, passageIdx) {
    const t = String(text || '').trim()
    if (!t) return
    setTranscript(prev => {
      const next = [...prev, { text: t, role: 'assistant', passageIdx }]
      setActiveIndex(next.length - 1)
      return next
    })
    speakText(t)
  }

  // Scroll the article iframe to passage[idx]. isProgrammatic suppresses the
  // manual-scroll flag so auto-scroll continues working after our own scrolls.
  function scrollToPassage(idx, isProgrammatic = false) {
    // Auto-scroll (TTS) honours the user's manual scroll position; pin clicks always go.
    if (isProgrammatic && userScrolledArticleRef.current) return
    if (isProgrammatic) {
      programmaticScrollRef.current = true
      setTimeout(() => { programmaticScrollRef.current = false }, 800)
    }
    if (!isProgrammatic) {
      // Pin click — make sure article overlay is visible
      setMediaOverlay('article')
    }
    // Use getElementById so we are never relying on stale DOM refs from before
    // a potential iframe remount. Retry up to 8 times × 250 ms to allow the
    // re-apply-highlights effect enough time to re-inject the spans after remount.
    const tryScroll = (left) => {
      const doc = articleIframeRef.current?.contentDocument
      const el  = doc?.getElementById(`webb-passage-${idx}`) ?? passageEls.current[idx]
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else if (left > 0) {
        setTimeout(() => tryScroll(left - 1), 250)
      }
    }
    setTimeout(() => tryScroll(8), 50)
  }

  // Seek to a segment and auto-play; useEffect above auto-pauses at endSec.
  function playSegment(startSec, endSec) {
    setMediaOverlay('video')
    segmentEndRef.current = typeof endSec === 'number' ? endSec : null
    // Poll for iframe mount in case the overlay was just opened
    const doCmd = (left) => {
      if (videoIframeRef.current?.contentWindow) {
        ytCmd('seekTo', [startSec, true])
        ytCmd('playVideo')
      } else if (left > 0) {
        setTimeout(() => doCmd(left - 1), 120)
      }
    }
    setTimeout(() => doCmd(10), 60)
  }

  // Add a transcript bubble tagged with momentIdx so it shows a ▶ replay button
  function addMomentMsg(text, momentIdx) {
    const t = String(text || '').trim()
    if (!t) return
    setTranscript(prev => {
      const next = [...prev, { text: t, role: 'assistant', momentIdx }]
      setActiveIndex(next.length - 1)
      return next
    })
  }

  // Resolves once the segment auto-pause fires or the deadline is reached
  function waitForSegmentEnd(endSec, maxWaitMs) {
    return new Promise(resolve => {
      const startedAt = Date.now()
      const deadline  = startedAt + (maxWaitMs ?? 90000)
      const check = () => {
        if (Date.now() - startedAt < 1500) { setTimeout(check, 400); return }
        if (segmentEndRef.current === null ||
            videoCurrentTimeRef.current >= endSec ||
            Date.now() > deadline) resolve()
        else setTimeout(check, 400)
      }
      setTimeout(check, 200)
    })
  }

  async function interpretVideo() {
    const vid = videoResource?.videoId
    if (!vid || interpretingVideo) return
    setInterpretingVideo(true)
    setMediaOverlay('video')
    setVideoMoments([])
    try {
      const res = await fetch('/api/webb-video-interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId:     vid,
          lessonTitle: selectedLesson?.title || '',
          grade:       selectedLesson?.grade ? `Grade ${selectedLesson.grade}` : 'elementary',
          learnerName: learnerName.current || '',
        }),
      })
      const data = await res.json()
      if (data.error === 'transcript_unavailable') {
        addMsg("I'd love to show you the key moments, but this video doesn't have captions available. You can still watch it and ask me questions!")
        return
      }
      const moments = data.moments || []
      if (!moments.length) {
        addMsg("I couldn't identify the key moments in this video. Try watching it and ask me about anything interesting!")
        return
      }
      setVideoMoments(moments)
      for (let i = 0; i < moments.length; i++) {
        const m = moments[i]
        if (m.intro) addMsg(m.intro)
        await waitForTTSIdle()
        addMomentMsg(`\uD83C\uDFA5 ${m.title} \u00B7 ${formatVideoTime(m.startSeconds)}`, i)
        const segMs = Math.max(10, m.endSeconds - m.startSeconds) * 1000
        playSegment(m.startSeconds, m.endSeconds)
        await waitForSegmentEnd(m.endSeconds, segMs + 8000)
        await new Promise(r => setTimeout(r, 600))
      }
      addMsg('Those were the key moments! What questions do you have?')
      await waitForTTSIdle()
    } catch (e) { console.error('[webb] interpretVideo error:', e) }
    setInterpretingVideo(false)
  }

  // ── Lesson list ───────────────────────────────────────────────────────
  async function loadLessons(id) {
    const lid = id ?? learnerId
    setPageError('')
    if (!lid) return
    try {
      const [availRes, historyRes] = await Promise.all([
        fetch(`/api/learner/available-lessons?learner_id=${encodeURIComponent(lid)}`)
          .then(r => r.ok ? r.json() : Promise.reject(new Error('Could not load lessons.'))),
        fetch(`/api/learner/lesson-history?learner_id=${encodeURIComponent(lid)}&limit=200`)
          .then(r => r.ok ? r.json() : null).catch(() => null),
      ])
      const { lessons = [] } = availRes || {}
      setAvailableLessons(lessons)
      setAllOwnedLessons(lessons)
      const seen = new Map()
      if (historyRes?.sessions) {
        const completed = historyRes.sessions.filter(s => s.status === 'completed' && s.lesson_id && s.ended_at)
        for (const s of completed) {
          const existing = seen.get(s.lesson_id)
          if (!existing || new Date(s.ended_at) > new Date(existing.ended_at)) seen.set(s.lesson_id, s)
        }
        setRecentSessions([...seen.values()].sort((a, b) => new Date(b.ended_at) - new Date(a.ended_at)))
      }
      const approvedKeySet = new Set(lessons.map(l => l.lessonKey || l.lesson_id || ''))
      const historyMissing = [...seen.keys()].filter(k => !approvedKeySet.has(k))
      if (historyMissing.length) {
        fetch('/api/lessons/meta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keys: historyMissing, learner_id: lid }),
        }).then(r => r.ok ? r.json() : null).then(res => {
          if (res?.lessons?.length) {
            const map = {}
            for (const l of res.lessons) map[l.lessonKey] = l
            setHistoryLessons(map)
          }
        }).catch(() => {})
      }
    } catch (e) {
      setPageError(e?.message || 'Could not load lessons.')
    }
  }

  // ── Preload resources for lesson ──────────────────────────────────────
  // Video and article are fetched in parallel but independently so each
  // resolves as soon as it's ready (video ~3s, article ~4s).
  // `objContext` is a hint string of remaining objectives used to shape the search.
  const preloadResources = useCallback((lesson, objContext = '') => {
    setVideoResource(null)
    setArticleResource(null)
    setVideoLoading(true)
    setArticleLoading(true)
    shownVideoIdsRef.current = []

    const post = (type) => fetch('/api/webb-resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lesson, type, context: objContext }),
    })

    // Video
    post('video')
      .then(r => r.json())
      .then(data => {
        if (data.video) {
          setVideoResource(data.video)
          if (data.video.videoId) shownVideoIdsRef.current = [data.video.videoId]
        }
      })
      .catch(() => {})
      .finally(() => setVideoLoading(false))

    // Article
    post('article')
      .then(r => r.json())
      .then(data => {
        if (data.article) {
          setArticleResource(data.article)
        }
      })
      .catch(() => {})
      .finally(() => setArticleLoading(false))
  }, [])

  // ── Objectives: generate when lesson starts ──────────────────────────
  // Generate objectives from the lesson question bank (fired once per lesson).
  // Fall back silently if the API is unavailable.
  const generateObjectives = useCallback(async (lesson) => {
    setObjectives([])
    setCompletedObj([])
    setNewlyCompletedObj(null)
    try {
      const res  = await fetch('/api/webb-objectives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', lesson }),
      })
      const data = await res.json()
      if (Array.isArray(data.objectives) && data.objectives.length) {
        setObjectives(data.objectives)
      }
    } catch { /* objectives are optional — fail silently */ }
  }, [])

  // ── Objectives: check after each student turn ─────────────────────────
  // Runs in the background after a normal chat turn; never blocks the UI.
  const checkObjectivesAfterTurn = useCallback(async (updatedMessages, currentObjectives, currentCompleted) => {
    if (!currentObjectives.length || checkingObjRef.current) return
    if (currentCompleted.length >= currentObjectives.length) return
    checkingObjRef.current = true
    try {
      const res  = await fetch('/api/webb-objectives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:           'check',
          objectives:       currentObjectives,
          completedIndices: currentCompleted,
          conversation:     updatedMessages,
        }),
      })
      const data = await res.json()
      const newly = data.newlyCompleted || []
      if (newly.length) {
        setCompletedObj(prev => {
          const next = [...new Set([...prev, ...newly])]
          // Show the tablet toast for the first newly completed objective
          const firstIdx = newly.find(i => !prev.includes(i))
          if (firstIdx !== undefined) {
            setNewlyCompletedObj({ idx: firstIdx, text: currentObjectives[firstIdx] })
          }
          return next
        })
      }
    } catch { /* fail silently */ }
    checkingObjRef.current = false
  }, [])

  // Auto-dismiss the tablet toast after 3.5 s
  useEffect(() => {
    if (!newlyCompletedObj) return
    const t = setTimeout(() => setNewlyCompletedObj(null), 3500)
    return () => clearTimeout(t)
  }, [newlyCompletedObj])

  // ── Select lesson → start AI chat ─────────────────────────────────────
  const selectLesson = useCallback(async (lesson) => {
    setPhase(PHASE.STARTING)
    setSelectedLesson(lesson)
    setTranscript([])
    setActiveIndex(-1)
    setChatMessages([])
    setVideoResource(null)
    setArticleResource(null)
    setMediaOverlay(null)
    setPageError('')
    setObjectives([])
    setCompletedObj([])
    setNewlyCompletedObj(null)

    // Get Mrs. Webb's opening greeting
    try {
      const res = await fetch('/api/webb-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [], lesson }),
      })
      const data = await res.json()
      const reply = data.reply || `Hi! I'm Mrs. Webb. Today we're exploring "${lesson.title}". What do you already know about this topic?`
      const firstMsg = { role: 'assistant', content: reply }
      setChatMessages([firstMsg])
      addMsg(reply)
    } catch {
      const fallback = `Hi! I'm Mrs. Webb. Let's explore "${lesson.title}" together! What do you already know?`
      setChatMessages([{ role: 'assistant', content: fallback }])
      addMsg(fallback)
    }

    setPhase(PHASE.CHATTING)

    // Preload media + generate objectives in background
    preloadResources(lesson)
    generateObjectives(lesson)
  }, [preloadResources, generateObjectives])

  // ── Send chat message ─────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || chatLoading) return
    addStudentLine(text)

    // ── UI FAQ intercept ──────────────────────────────────────────────────
    // Phase 2: action yes/no ("Want me to open it?")
    if (uiFaqActionPendingRef.current && uiFaqPendingRef.current) {
      if (!isYes(text) && !isNo(text)) {
        // Unrecognized — clear FAQ state and fall through to AI chat
        uiFaqPendingRef.current = null
        uiFaqActionPendingRef.current = false
      } else {
        const slug = uiFaqPendingRef.current
        uiFaqPendingRef.current = null
        uiFaqActionPendingRef.current = false
        if (isYes(text)) {
          addMsg('Sure thing! Opening it for you now.')
          if (slug === 'video')   setMediaOverlay('video')
          if (slug === 'article') setMediaOverlay('article')
        } else {
          addMsg("No problem! Just let me know if you need anything else.")
        }
        return
      }
    }
    // Phase 1: feature confirmation yes/no ("Are you wondering about X?")
    if (uiFaqPendingRef.current) {
      if (!isYes(text) && !isNo(text)) {
        // Unrecognized — clear FAQ state and fall through to AI chat
        uiFaqPendingRef.current = null
      } else {
        const slug = uiFaqPendingRef.current
        const cfg  = UI_FAQ[slug]
        if (isNo(text)) {
          uiFaqPendingRef.current = null
          addMsg("No problem! Ask me anything else about our lesson.")
        } else {
          addMsg(cfg.answer)
          if (cfg.actionSlug && cfg.actionPrompt) {
            uiFaqActionPendingRef.current = true
            setTimeout(() => addMsg(cfg.actionPrompt), 150)
          } else {
            uiFaqPendingRef.current = null
          }
        }
        return
      }
    }
    // Phase 0: detect a UI question / feature intent
    const uiSlug = detectUiQuestion(text)
    if (uiSlug) {
      const cfg = UI_FAQ[uiSlug]
      uiFaqPendingRef.current = uiSlug
      if (cfg.actionSlug) {
        // Action-capable feature: name the resource, give button location, ask to open
        // Jump straight to action-pending phase (skip the generic confirm → answer steps)
        uiFaqActionPendingRef.current = true
        let intro
        if (uiSlug === 'video') {
          const title = videoResource?.title && !videoResource?.unavailable
            ? `"${videoResource.title}"`
            : 'one picked just for your lesson'
          intro = `There's a video for you — ${title}! To watch it, ${cfg.location}. Want me to open it for you right now?`
        } else if (uiSlug === 'article') {
          const title = articleResource?.title
            ? `"${articleResource.title}"`
            : 'one about your lesson topic'
          intro = `There's a Wikipedia article ready for you — ${title}! To read it, ${cfg.location}. Would you like me to open it for you?`
        } else {
          // Generic fallback for any future actionSlug entries
          intro = `${cfg.answer} ${cfg.actionPrompt}`
        }
        addMsg(intro)
      } else {
        // Non-action feature: standard confirm → answer flow
        addMsg(cfg.confirm)
      }
      return
    }
    // ── Normal API call ───────────────────────────────────────────────────
    const userMsg = { role: 'user', content: text }
    const nextHistory = [...chatMessages, userMsg]
    setChatMessages(nextHistory)
    setChatLoading(true)
    try {
      const res = await fetch('/api/webb-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextHistory,
          lesson: selectedLesson,
          media: {
            video:   videoResource   || null,
            article: articleResource ? { title: articleResource.title, source: articleResource.source } : null,
          },
          // Pass remaining objectives so Mrs. Webb can weave in a probe question
          remainingObjectives: objectives.filter((_, i) => !completedObj.includes(i)),
        }),
      })
      const data = await res.json()
      const reply = data.reply || "That's great! Keep exploring this topic with me."
      const assistantMsg = { role: 'assistant', content: reply }
      const finalHistory = [...nextHistory, assistantMsg]
      setChatMessages(finalHistory)
      addMsg(reply)
      // Background: check if the student demonstrated any objectives
      setObjectives(obj => {
        setCompletedObj(comp => {
          checkObjectivesAfterTurn(finalHistory, obj, comp)
          return comp
        })
        return obj
      })
    } catch {
      const err = "I had a little trouble thinking. Can you say that again?"
      setChatMessages(prev => [...prev, { role: 'assistant', content: err }])
      addMsg(err)
    }
    setChatLoading(false)
  }, [chatLoading, chatMessages, selectedLesson, videoResource, articleResource, checkObjectivesAfterTurn])

  // ── Refresh a media resource (context-aware) ──────────────────────────
  async function refreshMedia(type) {
    setRefreshingMedia(true)
    const recentContext = chatMessages.slice(-6)
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join('. ')
    // Narrow search to remaining (incomplete) objectives
    const remaining = objectives
      .filter((_, i) => !completedObj.includes(i))
      .join('; ')
    const contextWithObj = [remaining, recentContext].filter(Boolean).join('. ')
    try {
      const res = await fetch('/api/webb-resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lesson: selectedLesson,
          type,
          context: contextWithObj,
          previousSource:         type === 'article' ? (articleResource?.source || '') : '',
          excludeVideoIds:        type === 'video'   ? shownVideoIdsRef.current      : [],
        }),
      })
      const data = await res.json()
      if (type === 'video' && data.video) {
        setVideoResource(data.video)
        if (data.video.videoId)
          shownVideoIdsRef.current = [...new Set([...shownVideoIdsRef.current, data.video.videoId])]
      }
      if (type === 'article' && data.article) {
        setArticleResource(data.article)
      }
    } catch {}
    setRefreshingMedia(false)
  }

  // ── Article passage scroll detector ─────────────────────────────────
  // Attaches a scroll listener so we know when the user has scrolled manually.
  useEffect(() => {
    if (mediaOverlay !== 'article') return
    const iframeEl = articleIframeRef.current
    if (!iframeEl) return
    userScrolledArticleRef.current = false
    let removeListener = () => {}
    const attach = () => {
      const win = iframeEl.contentWindow
      if (!win) return
      const onScroll = () => {
        if (!programmaticScrollRef.current) userScrolledArticleRef.current = true
      }
      win.addEventListener('scroll', onScroll, { passive: true })
      removeListener = () => win.removeEventListener('scroll', onScroll)
    }
    if (iframeEl.contentDocument?.readyState === 'complete') {
      attach()
    } else {
      const onLoad = () => attach()
      iframeEl.addEventListener('load', onLoad)
      return () => { iframeEl.removeEventListener('load', onLoad); removeListener() }
    }
    return () => removeListener()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaOverlay, articleResource])

  // ── Re-apply passage highlights every time the article overlay opens ──
  // The iframe unmounts when the overlay closes, destroying injected <span>s.
  // Stored excerpts let us re-highlight as soon as the iframe is ready again.
  useEffect(() => {
    if (mediaOverlay !== 'article' || !articlePassageExcerpts.length) return
    const iframeEl = articleIframeRef.current
    if (!iframeEl) return
    const apply = () => {
      const els = highlightPassages(articlePassageExcerpts)
      passageEls.current = els
    }
    if (iframeEl.contentDocument?.readyState === 'complete') {
      apply()
    } else {
      iframeEl.addEventListener('load', apply, { once: true })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaOverlay, articlePassageExcerpts])

  // Clear stored passage excerpts whenever the article content changes
  useEffect(() => {
    setArticlePassageExcerpts([])
    passageEls.current = []
  }, [articleResource])

  // ── Article interpret: highlight all passages and read each one in order ──
  async function interpretArticle() {
    if (!articleResource?.html || interpretingArticle) return
    setInterpretingArticle(true)
    // Ensure article overlay is open so the iframe exists in the DOM
    setMediaOverlay('article')
    // Reset so auto-scroll works cleanly on each new interpret run
    passageEls.current = []
    userScrolledArticleRef.current = false
    try {
      const res = await fetch('/api/webb-interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: articleResource.html,
          lessonTitle: selectedLesson?.title || '',
          grade: selectedLesson?.grade ? `Grade ${selectedLesson.grade}` : 'elementary',
          learnerName: learnerName.current || '',
        }),
      })
      const data = await res.json()
      const passages = data.passages || (data.excerpt ? [{ excerpt: data.excerpt }] : [])
      if (!passages.length) return

      const excerpts = passages.map(p => p.excerpt).filter(Boolean)

      // Wait for (a) React to flush setMediaOverlay and mount the iframe,
      // and (b) the iframe to finish loading its srcdoc content.
      // We poll for the ref because setState is async — the ref won't be set
      // until after the next React render cycle commits.
      await new Promise(resolve => {
        let tries = 0
        const check = () => {
          const iframe = articleIframeRef.current
          if (iframe) {
            if (iframe.contentDocument?.readyState === 'complete') {
              resolve()
            } else {
              // Register once-listener AND a safety timeout
              let settled = false
              const done = () => { if (!settled) { settled = true; resolve() } }
              iframe.addEventListener('load', done, { once: true })
              setTimeout(done, 3000)
            }
          } else if (tries++ < 40) {
            setTimeout(check, 100) // wait for React to commit the render
          } else {
            resolve() // give up after 4 s
          }
        }
        check()
      })

      // Highlight all passages and persist excerpts for remount re-apply
      const iframeEl = articleIframeRef.current
      setArticlePassageExcerpts(excerpts)
      const els = highlightPassages(excerpts)
      passageEls.current = els

      // Speak intro, then for each passage: wait for TTS → activate + scroll → speak
      if (data.intro) addMsg(data.intro)
      for (let i = 0; i < excerpts.length; i++) {
        await waitForTTSIdle()
        activatePassage(i)
        scrollToPassage(i, true)
        addPassageMsg(excerpts[i], i)
      }
      // Clear active highlight when done
      await waitForTTSIdle()
      const doc = articleIframeRef.current?.contentDocument
      doc?.querySelectorAll('.webb-hl-active').forEach(el => el.classList.remove('webb-hl-active'))
    } catch (e) { console.error('[webb] interpretArticle error:', e) }
    setInterpretingArticle(false)
  }

  // Returns a Promise that resolves when TTS has finished its current queue
  function waitForTTSIdle() {
    return new Promise(resolve => {
      const check = () => {
        if (!ttsBusyRef.current && ttsQueueRef.current.length === 0) resolve()
        else setTimeout(check, 150)
      }
      setTimeout(check, 400) // give TTS time to actually start before first check
    })
  }

  // Highlights an array of text excerpts in the article iframe by searching
  // element textContent (not window.find — which is broken in sandboxed iframes).
  // Assigns id="webb-passage-{i}" to each matched element so scrollToPassage
  // can use getElementById, which survives iframe remounts.
  function highlightPassages(excerpts) {
    const doc = articleIframeRef.current?.contentDocument
    if (!doc?.body) return excerpts.map(() => null)

    // Inject a <style> block for highlight rules (once per document load)
    if (!doc.getElementById('webb-hl-style')) {
      const s = doc.createElement('style')
      s.id = 'webb-hl-style'
      s.textContent =
        '.webb-hl{background:#fef08a!important;outline:2px solid #ca8a04!important;' +
        'border-radius:3px;scroll-margin-top:80px}' +
        '.webb-hl-active{background:#fbbf24!important;outline:2px solid #b45309!important}'
      try { doc.head?.appendChild(s) } catch { /* ignore */ }
    }

    // Clear previous highlights (class + id only — never alter inline styles)
    doc.querySelectorAll('.webb-hl,.webb-hl-active').forEach(el => {
      el.classList.remove('webb-hl', 'webb-hl-active')
      el.removeAttribute('id')
    })

    // Wikipedia textContent includes inline citation markers like [1], [2].
    // GPT excerpts don't include them, so we strip them before matching.
    const normText = s => (s || '')
      .replace(/\[\d+\]/g, '')           // [1], [23] …
      .replace(/\[[a-zA-Z]\]/g, '')      // [a], [B] …
      .replace(/\[note\s*\d*\]/gi, '')   // [note 1] …
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/^["'\u201c\u201d\u2018\u2019]+/, '') // strip GPT leading quotes
      .replace(/["'\u201c\u201d\u2018\u2019]+$/, '') // strip GPT trailing quotes
      .replace(/\s+/g, ' ')
      .trim()

    // All block-level candidates in document order
    const candidates = Array.from(
      doc.querySelectorAll('p,li,dt,dd,h2,h3,h4,h5,blockquote,td,th')
    )

    const results = []
    for (let i = 0; i < excerpts.length; i++) {
      const needle = normText(excerpts[i])
      let found = null
      // Try progressively shorter anchors to tolerate minor text diffs
      for (const len of [40, 25, 15]) {
        const anchor = needle.slice(0, len)
        if (!anchor) continue
        for (const el of candidates) {
          if (normText(el.textContent).includes(anchor)) {
            found = el
            break
          }
        }
        if (found) break
      }
      if (found) {
        found.id = `webb-passage-${i}`
        found.classList.add('webb-hl')
      }
      results.push(found || null)
    }
    return results
  }

  // Briefly adds the .webb-hl-active class to the passage being spoken
  function activatePassage(idx) {
    const doc = articleIframeRef.current?.contentDocument
    if (!doc) return
    doc.querySelectorAll('.webb-hl-active').forEach(el => el.classList.remove('webb-hl-active'))
    const el = doc.getElementById(`webb-passage-${idx}`)
    if (el) el.classList.add('webb-hl-active')
  }

  // ── Exit ──────────────────────────────────────────────────────────────
  async function handleExit() {
    const { ensurePinAllowed } = await import('@/app/lib/pinGate')
    if (!await ensurePinAllowed('session-exit')) return
    skipTTS()
    router.push('/learn')
  }

  function handleBack() {
    skipTTS()
    setPhase(PHASE.LIST)
    setSelectedLesson(null)
    setMediaOverlay(null)
  }

  // ── Layout styles ─────────────────────────────────────────────────────
  const videoEffH = videoMaxHeight && Number.isFinite(videoMaxHeight) ? videoMaxHeight : null
  const msSBSH    = videoEffH ? `${videoEffH}px` : (sideBySideHeight ? `${sideBySideHeight}px` : 'auto')

  const mainLayoutStyle = isMobileLandscape
    ? { display: 'flex', alignItems: 'stretch', flex: '1 1 0', overflow: 'hidden', background: '#fff', paddingLeft: 8, paddingRight: 8, boxSizing: 'border-box', '--msSideBySideH': msSBSH }
    : { display: 'flex', flexDirection: 'column', flex: '1 1 0', overflow: 'hidden', background: '#fff' }

  const videoWrapperStyle = isMobileLandscape
    ? { flex: `0 0 ${videoColPercent}%`, position: 'relative', overflow: 'hidden', minWidth: 0, height: 'var(--msSideBySideH)', display: 'flex', flexDirection: 'column' }
    : { flex: '0 0 50%', position: 'relative', width: '100%', overflow: 'hidden', minHeight: 0, boxSizing: 'border-box' }

  const dynH = (isMobileLandscape && videoEffH) ? { height: videoEffH, maxHeight: videoEffH, minHeight: 0 } : {}

  const videoInnerStyle = isMobileLandscape
    ? { position: 'relative', overflow: 'hidden', aspectRatio: '16 / 7.2', minHeight: 200, width: '100%', background: '#000', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.12)', ...dynH }
    : { position: 'relative', overflow: 'hidden', height: 'calc(100% - 4px)', width: '92%', margin: '4px auto 0', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.12)', background: '#000' }

  const transcriptWrapperStyle = isMobileLandscape
    ? { flex: `0 0 ${100 - videoColPercent}%`, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, height: 'var(--msSideBySideH)', maxHeight: 'var(--msSideBySideH)', paddingLeft: 8, boxSizing: 'border-box' }
    : { flex: '0 0 50%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff', minHeight: 0 }

  // ── Media overlay effects ─────────────────────────────────────────────

  // 1. Reset position + fullscreen state when overlay is closed
  useEffect(() => {
    if (!mediaOverlay) {
      setMediaPos('video')
      setMediaIsFullscreen(false)
      if (typeof document !== 'undefined' && document.fullscreenElement)
        document.exitFullscreen?.().catch(() => {})
    }
  }, [mediaOverlay])

  // 2. Sync mediaIsFullscreen with the browser fullscreen API
  useEffect(() => {
    const onFSChange = () => setMediaIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFSChange)
    return () => document.removeEventListener('fullscreenchange', onFSChange)
  }, [])

  // 3. Measure the target element rect and keep it updated via ResizeObserver.
  //    Runs whenever mediaPos or mediaOverlay changes so the rect is current
  //    immediately after the user opens or moves the overlay.
  useEffect(() => {
    if (!mediaOverlay) { setOverlayRect(null); return }
    const target = (mediaPos === 'video' ? videoInnerRef : chatColRef).current
    if (!target) return
    const measure = () => {
      const r = target.getBoundingClientRect()
      if (r.width > 0 && r.height > 0)
        setOverlayRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    measure()
    let ro
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure)
      ro.observe(target)
    }
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, { passive: true })
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure)
    }
  }, [mediaPos, mediaOverlay])

  // ── Media overlay helpers ─────────────────────────────────────────────
  function toggleMediaFullscreen() {
    if (!mediaIsFullscreen) mediaOverlayRef.current?.requestFullscreen?.().catch(() => {})
    else document.exitFullscreen?.().catch(() => {})
  }
  const mediaMoveToChat = mediaPos === 'video'
  const arrowGlyph = isMobileLandscape
    ? (mediaMoveToChat ? '\u2192' : '\u2190')  // → or ←
    : (mediaMoveToChat ? '\u2193' : '\u2191')  // ↓ or ↑
  const overlayPanelStyle = overlayRect
    ? {
        position: 'fixed',
        top:    mediaIsFullscreen ? overlayRect.top    : overlayRect.top    + overlayRect.height * 0.04,
        left:   mediaIsFullscreen ? overlayRect.left   : overlayRect.left   + overlayRect.width  * 0.03,
        width:  mediaIsFullscreen ? overlayRect.width  : overlayRect.width  * 0.94,
        height: mediaIsFullscreen ? overlayRect.height : overlayRect.height * 0.80,
        background: '#000',
        borderRadius: mediaIsFullscreen ? 0 : 10,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', zIndex: 20,
        boxShadow: mediaIsFullscreen ? 'none' : '0 0 0 2px rgba(13,148,136,0.6)',
      }
    : mediaIsFullscreen
      ? { position: 'fixed', inset: 0, background: '#000', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 20 }
      : null

  const isChatting = phase === PHASE.CHATTING

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ background: C.accentDark, color: '#fff', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }} aria-hidden>&#128105;&#127995;&#8205;&#127979;</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: 0.5 }}>MRS. WEBB</div>
              {selectedLesson
                ? <div style={{ fontSize: 11, opacity: 0.85, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedLesson.title}</div>
                : <div style={{ fontSize: 11, opacity: 0.75, letterSpacing: 1 }}>LESSON TEACHER</div>
              }
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isChatting && (
              <button type="button" onClick={handleBack} style={headerBtn}>
                &#8592; Lessons
              </button>
            )}
            <button type="button" onClick={handleExit} style={headerBtn}>
              &#8592; BACK
            </button>
          </div>
        </div>
      </div>

      {pageError && (
        <div style={{ background: '#fef2f2', borderBottom: '1px solid #fca5a5', color: C.danger, padding: '8px 16px', fontSize: 13, textAlign: 'center', flexShrink: 0 }}>
          {pageError}
        </div>
      )}

      {/* Main two-panel layout — always visible */}
      <div style={mainLayoutStyle}>

        {/* Video column */}
        <div ref={videoColRef} style={videoWrapperStyle}>
          <div ref={videoInnerRef} style={videoInnerStyle}>

            {/* Teacher video */}
            <video
              ref={videoRef}
              src="/media/webb-teacher.mp4"
              muted loop playsInline preload="auto"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
            />

            {/* Media overlay: rendered as portal — see createPortal block near end of return */}

            {/* Overlay buttons — bottom right: Skip + Mute (always) */}
            <div style={{ position: 'absolute', bottom: 14, right: 14, display: 'flex', gap: 10, zIndex: 10 }}>
              {engineState === 'playing' && (
                <button type="button" onClick={skipTTS} aria-label="Skip" style={overlayBtnStyle}>
                  <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" />
                  </svg>
                </button>
              )}
              <button type="button" onClick={toggleMute} aria-label={isMuted ? 'Unmute' : 'Mute'} style={overlayBtnStyle}>
                {isMuted
                  ? <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M23 9l-6 6" /><path d="M17 9l6 6" /></svg>
                  : <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M19 8a5 5 0 010 8" /><path d="M15 11a2 2 0 010 2" /></svg>
                }
              </button>
            </div>

            {/* Overlay buttons — bottom left: Video + Article (chatting phase) */}
            {isChatting && (
              <div style={{ position: 'absolute', bottom: 14, left: 14, display: 'flex', gap: 10, zIndex: 10 }}>
                <button
                  type="button"
                  onClick={() => { setMediaOverlay(v => v === 'video' ? null : 'video') }}
                  aria-label="Watch a video"
                  title={videoLoading ? 'Loading video…' : videoResource ? 'Watch a video' : 'Loading video…'}
                  style={{ ...overlayBtnStyle, background: mediaOverlay === 'video' ? C.accent : '#1f2937', opacity: videoLoading ? 0.55 : 1 }}
                >
                  {videoLoading
                    ? <svg style={{ width: '55%', height: '55%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="28 8" /></svg>
                    : <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                  }
                </button>
                <button
                  type="button"
                  onClick={() => { setMediaOverlay(v => v === 'article' ? null : 'article') }}
                  aria-label="Read Wikipedia article"
                  title={articleLoading ? 'Finding Wikipedia article…' : articleResource ? `Wikipedia: ${articleResource.wikiTitle}` : 'Finding Wikipedia article…'}
                  style={{ ...overlayBtnStyle, background: mediaOverlay === 'article' ? C.accent : '#1f2937', opacity: articleLoading ? 0.55 : 1 }}
                >
                  {articleLoading
                    ? <svg style={{ width: '55%', height: '55%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="28 8" /></svg>
                    : <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
                  }
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Transcript / browser column */}
        <div ref={chatColRef} style={transcriptWrapperStyle}>

          {/* Lesson browser (LIST and STARTING phases) */}
          {(phase === PHASE.LIST || phase === PHASE.STARTING) && (
            <WebbLessonBrowser
              availableLessons={availableLessons}
              allOwnedLessons={allOwnedLessons}
              recentSessions={recentSessions}
              historyLessons={historyLessons}
              listTab={listTab}
              setListTab={setListTab}
              ownedFilters={ownedFilters}
              setOwnedFilters={setOwnedFilters}
              listError={listError}
              setListError={setListError}
              onStart={selectLesson}
              learnerName={learnerName.current}
              starting={phase === PHASE.STARTING}
            />
          )}

          {/* Chat thread — iMessage-style bubbles */}
          {isChatting && (
            <div
              ref={transcriptRef}
              style={{
                flex: '1 1 0', minHeight: 0,
                overflowY: 'auto', overflowX: 'hidden',
                padding: '16px 12px 8px',
                display: 'flex', flexDirection: 'column', gap: 8,
                background: '#f9fafb',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {transcript.map((msg, i) => {
                const isUser = msg.role === 'user'
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-end', gap: 7, flexDirection: isUser ? 'row-reverse' : 'row', padding: '0 2px' }}>
                    {!isUser && (
                      <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, marginBottom: 1 }} aria-hidden>&#128105;&#127995;&#8205;&#127979;</span>
                    )}
                    <div style={{
                      maxWidth: 'min(78%, 360px)',
                      background: isUser ? C.accent : '#ffffff',
                      color: isUser ? '#ffffff' : C.text,
                      borderRadius: isUser ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
                      padding: '9px 13px',
                      fontSize: 14, lineHeight: 1.55,
                      wordBreak: 'break-word',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.09)',
                      border: isUser ? 'none' : '1px solid #e5e7eb',
                    }}>
                      {msg.momentIdx != null ? (
                        <>
                          {msg.text}
                          {' '}
                          <button
                            type="button"
                            onClick={() => { const m = videoMoments[msg.momentIdx]; if (m) playSegment(m.startSeconds, m.endSeconds) }}
                            title="Replay this moment in the video"
                            style={{
                              display: 'inline',
                              background: 'none', border: 'none',
                              padding: '0 1px', margin: 0,
                              cursor: 'pointer', fontSize: 12, fontWeight: 700,
                              color: '#0d9488',
                              fontFamily: 'inherit', verticalAlign: 'baseline',
                              lineHeight: 'inherit',
                            }}
                          >&#9654;</button>
                        </>
                      ) : msg.passageIdx != null ? (
                        <>
                          {msg.text}
                          {' '}
                          <button
                            type="button"
                            onClick={() => scrollToPassage(msg.passageIdx)}
                            title="Jump to this passage in the article"
                            style={{
                              display: 'inline',
                              background: 'none', border: 'none',
                              padding: '0 1px', margin: 0,
                              cursor: 'pointer', fontSize: 13,
                              color: '#0d9488', textDecoration: 'underline',
                              fontFamily: 'inherit', verticalAlign: 'baseline',
                              lineHeight: 'inherit',
                            }}
                          >&#128205;</button>
                        </>
                      ) : msg.text}
                    </div>
                  </div>
                )
              })}
              {/* Typing indicator */}
              {chatLoading && (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, padding: '0 2px' }}>
                  <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, marginBottom: 1 }} aria-hidden>&#128105;&#127995;&#8205;&#127979;</span>
                  <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '4px 18px 18px 18px', padding: '10px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.09)' }}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {[0, 160, 320].map(d => (
                        <span key={d} style={{ display: 'block', width: 7, height: 7, borderRadius: '50%', background: '#9ca3af', animation: `webb-bounce 1s ease-in-out ${d}ms infinite` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} style={{ height: 1 }} />
            </div>
          )}
        </div>
      </div>

      {/* Footer: chat input */}
      {isChatting && (
        <div style={footerStyle}>
          <StudentInput
            onSend={sendMessage}
            loading={chatLoading}
          />
        </div>
      )}

      {/* ── Portaled media overlay — position:fixed, moves between video/chat cols ── */}
      {isChatting && mediaOverlay && overlayPanelStyle && createPortal(
        <div ref={mediaOverlayRef} style={overlayPanelStyle}>

          {/* Toolbar */}
          <div style={{ background: 'rgba(15,118,110,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>
              {mediaOverlay === 'video' ? '\u25B6 VIDEO' : '\uD83D\uDCD6 ARTICLE'}
              {mediaOverlay === 'article' && articleResource?.source && (
                <span style={{ opacity: 0.75, fontWeight: 400, marginLeft: 4 }}>\u00B7 {articleResource.source}</span>
              )}
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {/* Refresh */}
              <button type="button" onClick={() => refreshMedia(mediaOverlay)} disabled={refreshingMedia} title="Load a different one"
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: 12, cursor: refreshingMedia ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                {refreshingMedia ? '\u2026' : '\u21BB'}
              </button>
              {/* Interpret: play key moments (video only) */}
              {mediaOverlay === 'video' && videoResource?.videoId && !videoResource?.unavailable && (
                <button type="button" onClick={interpretVideo} disabled={interpretingVideo} title="Mrs. Webb plays the key moments"
                  style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 4, padding: '3px 6px', cursor: interpretingVideo ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}>
                  {interpretingVideo
                    ? <svg style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="28 8" /></svg>
                    : <svg style={{ width: 12, height: 12 }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  }
                  <span>Key part</span>
                </button>
              )}
              {/* Interpret: find + highlight + read key passage (article only) */}
              {mediaOverlay === 'article' && articleResource?.html && (
                <button type="button" onClick={interpretArticle} disabled={interpretingArticle} title="Mrs. Webb reads the key part"
                  style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 4, padding: '3px 6px', cursor: interpretingArticle ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}>
                  {interpretingArticle
                    ? <svg style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="28 8" /></svg>
                    : <svg style={{ width: 12, height: 12 }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                  }
                  <span>Key part</span>
                </button>
              )}
              {/* Move arrow — hidden in fullscreen */}
              {!mediaIsFullscreen && (
                <button type="button"
                  onClick={() => setMediaPos(p => p === 'video' ? 'chat' : 'video')}
                  title={mediaMoveToChat ? 'Move to conversation' : 'Move to video'}
                  style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1 }}>
                  {arrowGlyph}
                </button>
              )}
              {/* Fullscreen toggle */}
              <button type="button" onClick={toggleMediaFullscreen} title={mediaIsFullscreen ? 'Exit fullscreen' : 'Full screen'}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 4, padding: '3px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                {mediaIsFullscreen
                  ? <svg style={{ width: 12, height: 12 }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>
                  : <svg style={{ width: 12, height: 12 }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                }
              </button>
              {/* Close */}
              <button type="button" onClick={() => setMediaOverlay(null)} title="Close"
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                {'\u2715'}
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>

            {/* ── VIDEO ── */}
            {mediaOverlay === 'video' && videoResource?.embedUrl && (
              <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#000' }}>
                <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                  <iframe
                    ref={videoIframeRef}
                    src={videoResource.embedUrl}
                    title={videoResource.title || 'Educational video'}
                    allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                    style={{ width: '100%', height: '100%', border: 'none' }}
                  />
                  {videoEnded && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24, boxSizing: 'border-box' }}>
                      <div style={{ fontSize: 38 }}>&#127881;</div>
                      <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, textAlign: 'center' }}>
                        Great job watching!<br/>
                        <span style={{ fontSize: 13, fontWeight: 400, color: '#9ca3af' }}>{videoResource.title}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                        <button type="button" onClick={() => { setVideoEnded(false); ytCmd('seekTo', [0, true]); ytCmd('playVideo') }}
                          style={{ background: '#374151', border: 'none', color: '#fff', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                        >&#8635; Replay</button>
                        <button type="button" onClick={() => { setVideoEnded(false); refreshMedia('video') }} disabled={refreshingMedia}
                          style={{ background: C.accent, border: 'none', color: '#fff', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: refreshingMedia ? 'wait' : 'pointer', fontFamily: 'inherit' }}
                        >{refreshingMedia ? '\u2026' : '\u25B6 Watch another'}</button>
                        <button type="button" onClick={() => setMediaOverlay(null)}
                          style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#9ca3af', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                        >&#10005; Close</button>
                      </div>
                    </div>
                  )}
                </div>
                {!videoEnded && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', background: '#111', flexShrink: 0, userSelect: 'none' }}>
                    <button type="button" onClick={() => videoPlaying ? ytCmd('pauseVideo') : ytCmd('playVideo')}
                      style={{ background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}
                      title={videoPlaying ? 'Pause' : 'Play'}>{videoPlaying ? '\u23F8' : '\u25B6'}</button>
                    <span style={{ color: '#9ca3af', fontSize: 11, minWidth: 36, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatVideoTime(videoCurrentTime)}</span>
                    <input type="range" min={0} max={videoDuration || 100} value={videoCurrentTime} step={1}
                      onChange={e => { const t = Number(e.target.value); setVideoCurrentTime(t); ytCmd('seekTo', [t, true]) }}
                      style={{ flex: 1, accentColor: C.accent, cursor: 'pointer', height: 4 }} />
                    <span style={{ color: '#9ca3af', fontSize: 11, minWidth: 36, fontVariantNumeric: 'tabular-nums' }}>{formatVideoTime(videoDuration)}</span>
                    <button type="button" onClick={() => { videoVolumeMuted ? ytCmd('unMute') : ytCmd('mute'); setVideoVolumeMuted(m => !m) }}
                      style={{ background: 'none', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}
                      title={videoVolumeMuted ? 'Unmute' : 'Mute'}>{videoVolumeMuted ? '\uD83D\uDD07' : '\uD83D\uDD0A'}</button>
                  </div>
                )}
              </div>
            )}
            {/* Fallback: no YT key */}
            {mediaOverlay === 'video' && videoResource?.unavailable && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14, padding: 20, background: '#0f0f0f', boxSizing: 'border-box', textAlign: 'center' }}>
                <svg viewBox="0 0 24 24" style={{ width: 44, height: 44 }} fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8l4 4-4 4"/></svg>
                <div style={{ color: '#9ca3af', fontSize: 13, lineHeight: 1.6, maxWidth: 220 }}>Video not available right now.<br/>Tap <strong style={{ color: '#fff' }}>\u21BB</strong> above to try a different one.</div>
                <button type="button" onClick={() => refreshMedia('video')} disabled={refreshingMedia}
                  style={{ background: C.accent, border: 'none', color: '#fff', borderRadius: 6, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: refreshingMedia ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                  {refreshingMedia ? '\u2026' : '\u21BB Try another'}
                </button>
              </div>
            )}

            {/* ── ARTICLE ── */}
            {mediaOverlay === 'article' && articleResource?.html && (
              <iframe ref={articleIframeRef} srcDoc={articleResource.html} title={articleResource.title || 'Educational article'}
                sandbox="allow-same-origin allow-scripts" style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} />
            )}
            {/* Loading: preload in-flight OR refresh in-progress */}
            {mediaOverlay === 'article' && (articleLoading || refreshingMedia) && !articleResource?.html && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: '#9ca3af', fontSize: 13, background: '#fff' }}>
                <svg viewBox="0 0 24 24" style={{ width: 32, height: 32, animation: 'spin 1s linear infinite' }} fill="none" stroke="#0d9488" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="28 8" /></svg>
                Finding an article&hellip;
              </div>
            )}
            {/* Fallback: no article (or failed html) and not currently loading */}
            {mediaOverlay === 'article' && !articleLoading && !refreshingMedia && !articleResource?.html && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14, padding: 20, background: '#fff', boxSizing: 'border-box', textAlign: 'center' }}>
                <svg viewBox="0 0 24 24" style={{ width: 40, height: 40 }} fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>Couldn&apos;t load the article.<br/>Tap below to try a different one.</div>
                <button type="button" onClick={() => refreshMedia('article')}
                  style={{ ...primaryBtn }}>
                  {'\u21BB'} Try another article
                </button>
              </div>
            )}
            {mediaOverlay === 'video' && !videoResource && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 13 }}>{'Generating\u2026'}</div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ── Objective tablet toast ──────────────────────────────────── */}
      {newlyCompletedObj && createPortal(
        <div style={{
          position: 'fixed',
          bottom: 80, left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 999,
          width: 'min(88vw, 360px)',
          animation: 'webb-tablet-in 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards',
          pointerEvents: 'none',
        }}>
          {/* tablet frame */}
          <div style={{
            background: '#1a1a2e',
            borderRadius: 22,
            padding: '6px 8px 10px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.55), 0 0 0 2px #0d9488',
          }}>
            {/* camera notch */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
              <div style={{ width: 40, height: 6, borderRadius: 3, background: '#2d2d4e' }} />
            </div>
            {/* screen area */}
            <div style={{
              background: '#0f172a',
              borderRadius: 14,
              padding: '18px 20px 16px',
              border: '1px solid #1e40af',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 22 }}>✅</span>
                <span style={{ color: '#0d9488', fontWeight: 800, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' }}>Objective Complete</span>
              </div>
              <p style={{
                color: '#e2e8f0', fontSize: 13, lineHeight: 1.6,
                margin: 0, fontStyle: 'italic',
              }}>“{newlyCompletedObj.text}”</p>
              {/* completed tally */}
              <div style={{ marginTop: 12, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {objectives.map((_, i) => (
                  <div key={i} style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: completedObj.includes(i) ? '#0d9488' : '#374151',
                    transition: 'background 0.3s',
                  }} />
                ))}
              </div>
            </div>
            {/* home button row */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #374151', background: '#1a1a2e' }} />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const overlayBtnStyle = {
  background: '#1f2937', color: '#fff', border: 'none',
  width: 'clamp(34px, 6.2vw, 52px)', height: 'clamp(34px, 6.2vw, 52px)',
  display: 'grid', placeItems: 'center',
  borderRadius: '50%', cursor: 'pointer',
  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
  transition: 'background 0.2s',
}

const primaryBtn = {
  background: '#0d9488', color: '#fff', border: 'none',
  borderRadius: 8, padding: '10px 20px',
  fontSize: 14, fontWeight: 700, cursor: 'pointer',
  fontFamily: 'inherit',
}

const headerBtn = {
  background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.35)',
  color: '#fff', borderRadius: 8, padding: '6px 14px',
  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
}

const footerStyle = {
  flexShrink: 0, background: '#fff',
  borderTop: '1px solid #e5e7eb',
  padding: '10px 16px',
  paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
}

// ── WebbLessonBrowser ─────────────────────────────────────────────────────────
function WebbLessonBrowser({
  availableLessons, allOwnedLessons, recentSessions, historyLessons,
  listTab, setListTab, ownedFilters, setOwnedFilters,
  listError, setListError, onStart, learnerName, starting = false,
}) {
  const getLk = l => l.lessonKey || l.lesson_id || `${l.subject || 'general'}/${l.file || ''}`

  const mergedMap = new Map(allOwnedLessons.map(l => [getLk(l), l]))
  Object.entries(historyLessons).forEach(([k, l]) => { if (!mergedMap.has(k)) mergedMap.set(k, l) })

  const completedKeys = new Set(recentSessions.map(s => s.lesson_id))
  const activeList = availableLessons.filter(l => !completedKeys.has(getLk(l)))
  const recentList = recentSessions.map(s => ({ session: s, lesson: mergedMap.get(s.lesson_id) }))

  const fullOwnedLessons = [...mergedMap.values()]
  const allSubjects = [...new Set(fullOwnedLessons.map(l => l.subject).filter(s => s && s !== 'generated'))].sort()
  const allGrades = [...new Set(fullOwnedLessons.map(l => l.grade).filter(v => v != null))].sort((a, b) => Number(a) - Number(b))
  const ownedList = fullOwnedLessons.filter(l => {
    if (ownedFilters.subject && l.subject !== ownedFilters.subject) return false
    if (ownedFilters.grade && String(l.grade) !== ownedFilters.grade) return false
    return true
  })

  const tabStyle = active => ({
    background: active ? C.accent : 'transparent',
    color: active ? '#fff' : C.muted,
    border: `1.5px solid ${active ? C.accent : C.border}`,
    borderRadius: 8, padding: '6px 16px',
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit', letterSpacing: 0.5, transition: 'all 0.15s',
  })

  const LessonCard = ({ lesson, dateLabel }) => {
    const lk = getLk(lesson)
    const done = completedKeys.has(lk)
    const subjectLabel = (lesson.subject || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    const gradeLabel = lesson.grade ? `Grade ${lesson.grade}` : ''
    const diffLabel = lesson.difficulty ? lesson.difficulty.charAt(0).toUpperCase() + lesson.difficulty.slice(1) : ''
    return (
      <button
        type="button"
        onClick={() => onStart(lesson)}
        style={{
          background: '#fff', borderRadius: 12,
          border: `1.5px solid ${done ? C.success : C.border}`,
          padding: '14px 16px', textAlign: 'left',
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 12, width: '100%',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)', fontFamily: 'inherit',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ color: C.text, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
            {done && <span style={{ color: C.success, marginRight: 6 }}>&#10003;</span>}
            {lesson.title || lk}
          </div>
          <div style={{ color: C.muted, fontSize: 12 }}>
            {[subjectLabel, gradeLabel, diffLabel].filter(Boolean).join(' \u00b7 ')}
            {done && <span style={{ color: C.success, marginLeft: 8 }}>Completed</span>}
            {dateLabel && <span style={{ marginLeft: 8 }}>{dateLabel}</span>}
          </div>
        </div>
        <div style={{ color: C.accent, fontWeight: 800, fontSize: 20, flexShrink: 0 }}>&#9654;</div>
      </button>
    )
  }

  const RecentRow = ({ session, lesson }) => {
    const dateLabel = session.ended_at
      ? new Date(session.ended_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : ''
    if (lesson) return <LessonCard lesson={lesson} dateLabel={dateLabel} />
    return (
      <div style={{ background: '#f9fafb', border: `1.5px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', opacity: 0.6 }}>
        <div style={{ color: C.muted, fontSize: 13 }}>{session.lesson_id || '\u2014'}</div>
        {dateLabel && <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>{dateLabel}</div>}
      </div>
    )
  }

  return (
    <div style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      {/* Starting overlay */}
      {starting && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ color: C.accentDark, fontSize: 14, fontWeight: 600 }}>Starting lesson&hellip;</div>
        </div>
      )}

      {/* Controls strip */}
      <div style={{ flexShrink: 0, padding: '14px 14px 0', maxWidth: 680, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 800, color: C.accentDark, fontSize: 15 }}>
            {learnerName ? `Hi, ${learnerName}! \uD83D\uDC4B` : 'Welcome to Mrs. Webb!'}
          </div>
          <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>Choose a lesson to begin chatting.</div>
        </div>

        {listError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '8px 12px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ color: C.danger, fontSize: 12 }}>{listError}</span>
            <button type="button" onClick={() => setListError('')} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}>&#10005;</button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={tabStyle(listTab === 'active')} onClick={() => setListTab('active')}>ACTIVE</button>
          <button type="button" style={tabStyle(listTab === 'recent')} onClick={() => setListTab('recent')}>
            RECENT{recentList.length > 0 ? ` (${recentList.length})` : ''}
          </button>
          <button type="button" style={tabStyle(listTab === 'owned')} onClick={() => setListTab('owned')}>
            OWNED{mergedMap.size > 0 ? ` (${mergedMap.size})` : ''}
          </button>
        </div>

        {listTab === 'owned' && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <select value={ownedFilters.subject} onChange={e => setOwnedFilters(f => ({ ...f, subject: e.target.value }))}
                style={{ background: '#fff', color: ownedFilters.subject ? C.text : C.muted, border: `1.5px solid ${C.border}`, borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                <option value=''>ALL SUBJECTS</option>
                {allSubjects.map(s => <option key={s} value={s}>{s.replace(/-/g, ' ').toUpperCase()}</option>)}
              </select>
              <select value={ownedFilters.grade} onChange={e => setOwnedFilters(f => ({ ...f, grade: e.target.value }))}
                style={{ background: '#fff', color: ownedFilters.grade ? C.text : C.muted, border: `1.5px solid ${C.border}`, borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                <option value=''>ALL GRADES</option>
                {allGrades.map(g => <option key={g} value={String(g)}>GRADE {g}</option>)}
              </select>
              {(ownedFilters.subject || ownedFilters.grade) && (
                <button type="button" onClick={() => setOwnedFilters({ subject: '', grade: '' })}
                  style={{ background: 'none', border: `1.5px solid ${C.border}`, borderRadius: 6, color: C.muted, fontSize: 12, cursor: 'pointer', padding: '4px 8px', fontFamily: 'inherit' }}>
                  &#10005; CLEAR
                </button>
              )}
            </div>
            {mergedMap.size > 0 && <div style={{ color: C.muted, fontSize: 11 }}>{ownedList.length} of {mergedMap.size} lessons</div>}
          </div>
        )}
      </div>

      {/* Scrollable list */}
      <div style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', padding: '12px 14px 24px', maxWidth: 680, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {listTab === 'active' && (
          availableLessons.length === 0
            ? <div style={{ textAlign: 'center', marginTop: 40, color: C.muted, fontSize: 14 }}>No lessons available yet.</div>
            : activeList.length === 0
              ? <div style={{ textAlign: 'center', marginTop: 40, color: C.success, fontSize: 14 }}>All lessons completed! Check RECENT or OWNED. &#10003;</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ color: C.muted, fontSize: 11, letterSpacing: 1, marginBottom: 4 }}>{activeList.length} LESSON{activeList.length !== 1 ? 'S' : ''} AVAILABLE</div>
                  {activeList.map((l, i) => <LessonCard key={getLk(l) || i} lesson={l} />)}
                </div>
        )}
        {listTab === 'recent' && (
          recentList.length === 0
            ? <div style={{ textAlign: 'center', marginTop: 40, color: C.muted, fontSize: 14 }}>No completed lessons yet.</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ color: C.muted, fontSize: 11, letterSpacing: 1, marginBottom: 4 }}>{recentList.length} COMPLETED LESSON{recentList.length !== 1 ? 'S' : ''}</div>
                {recentList.map((r, i) => <RecentRow key={r.session.id || i} session={r.session} lesson={r.lesson} />)}
              </div>
        )}
        {listTab === 'owned' && (
          ownedList.length === 0
            ? <div style={{ textAlign: 'center', marginTop: 40, color: C.muted, fontSize: 14 }}>NO LESSONS MATCH FILTERS</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ownedList.map((l, i) => <LessonCard key={getLk(l) || i} lesson={l} />)}
              </div>
        )}
      </div>
    </div>
  )
}

// ── StudentInput ──────────────────────────────────────────────────────────────
function StudentInput({ onSend, loading }) {
  const [value, setValue] = useState('')
  const ref = useRef(null)

  useEffect(() => { ref.current?.focus() }, [])

  function submit() {
    const t = value.trim()
    if (!t || loading) return
    onSend(t)
    setValue('')
  }

  return (
    <div style={{ display: 'flex', gap: 8, width: '100%', alignItems: 'flex-end' }}>
      <textarea
        ref={ref}
        rows={2}
        value={value}
        disabled={loading}
        onChange={e => setValue(e.target.value.slice(0, 400))}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
        placeholder={loading ? 'Mrs. Webb is thinking\u2026' : 'Type a message\u2026'}
        aria-label="Chat with Mrs. Webb"
        style={{
          flex: 1, border: `1.5px solid ${C.border}`, borderRadius: 10,
          padding: '8px 12px', fontSize: 15, resize: 'none', outline: 'none',
          fontFamily: 'inherit', background: loading ? '#f9fafb' : '#fff',
          color: C.text, WebkitAppearance: 'none',
        }}
      />
      <button
        type="button"
        onClick={submit}
        disabled={loading || !value.trim()}
        style={{
          ...primaryBtn,
          opacity: (loading || !value.trim()) ? 0.5 : 1,
          cursor: (loading || !value.trim()) ? 'not-allowed' : 'pointer',
          padding: '10px 16px', alignSelf: 'stretch',
          display: 'flex', alignItems: 'center',
        }}
      >
        {loading ? '\u2026' : '\u2192'}
      </button>
    </div>
  )
}